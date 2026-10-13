import { useState } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, Edit, Trash2, FileText, Image, User } from "lucide-react";
import { formatDate } from "@/lib/utils";

const documentTypes = [
  { value: "transcript", label: "Transcript" },
  { value: "certificate", label: "Certificate" },
  { value: "recommendation_letter", label: "Recommendation Letter" },
  { value: "essay", label: "Essay" },
  { value: "portfolio", label: "Portfolio" },
  { value: "other", label: "Other" }
];

const uploadFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  documentType: z.string().min(1, "Document type is required"),
  studentId: z.string().min(1, "Student is required"),
  isPublic: z.boolean().default(true),
  file: z.any().refine((files) => files?.length == 1, "File is required.")
});

const editFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  documentType: z.string().min(1, "Document type is required"),
  isPublic: z.boolean()
});

type Document = {
  id: number;
  studentId: number;
  counselorId?: number;
  title: string;
  description?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: string;
  uploadedBy: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  student?: {
    id: number;
    user: {
      firstName?: string;
      lastName?: string;
      email?: string;
    };
  };
};

type Student = {
  id: number;
  user: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
};

export default function CounselorDocuments() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>("all");
  const [sortOrder, setSortOrder] = useState<string>("newest");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current user data with optimized caching
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/user'],
    staleTime: 10 * 60 * 1000, // 10 minutes - auth data changes rarely
    gcTime: 30 * 60 * 1000, // 30 minutes in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Fetch students for counselor with optimized caching
  const { data: students = [] } = useQuery<Student[]>({
    queryKey: ['/api/students'],
    staleTime: 5 * 60 * 1000, // 5 minutes - student list changes rarely
    gcTime: 15 * 60 * 1000, // 15 minutes in cache
    refetchOnWindowFocus: false, // Don't refetch on window focus
    enabled: (userData as any)?.role === 'counselor'
  });

  // Fetch documents for selected student - automatic real-time updates
  const { data: documents = [], isLoading } = useQuery<Document[]>({
    queryKey: [`/api/documents/${selectedStudentId}`],
    staleTime: 0, // Always fresh data - immediate updates
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    refetchOnWindowFocus: true, // Auto-refresh when user switches back to tab
    refetchInterval: 10 * 1000, // Auto-refresh every 10 seconds for faster updates
    enabled: !!selectedStudentId
  });


  // Upload form
  const uploadForm = useForm<z.infer<typeof uploadFormSchema>>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: {
      title: "",
      description: "",
      documentType: "",
      studentId: "",
      isPublic: true
    }
  });

  // Update studentId in form when selection changes
  React.useEffect(() => {
    if (selectedStudentId) {
      uploadForm.setValue('studentId', selectedStudentId);
    }
  }, [selectedStudentId, uploadForm]);

  // Edit form
  const editForm = useForm<z.infer<typeof editFormSchema>>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      title: "",
      description: "",
      documentType: "",
      isPublic: true
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: z.infer<typeof uploadFormSchema>) => {
      const formData = new FormData();
      formData.append('file', data.file[0]);
      formData.append('title', data.title);
      formData.append('description', data.description || '');
      formData.append('documentType', data.documentType);
      formData.append('studentId', data.studentId);
      formData.append('isPublic', data.isPublic.toString());

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Document uploaded successfully"
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/documents/${variables.studentId}`], 
        exact: true 
      });
      setUploadDialogOpen(false);
      uploadForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Edit mutation
  const editMutation = useMutation({
    mutationFn: async (data: z.infer<typeof editFormSchema> & { id: number }) => {
      return apiRequest(`/api/documents/${data.id}`, 'PUT', {
        title: data.title,
        description: data.description,
        documentType: data.documentType,
        isPublic: data.isPublic
      });
    },
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: "Document updated successfully"
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/documents/${selectedStudentId}`], 
        exact: true 
      });
      setEditDialogOpen(false);
      setEditingDocument(null);
      editForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/documents/${id}`, 'DELETE');
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Document deleted successfully"
      });
      queryClient.invalidateQueries({ 
        queryKey: [`/api/documents/${selectedStudentId}`], 
        exact: true 
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleUpload = (data: z.infer<typeof uploadFormSchema>) => {
    if (!selectedStudentId) {
      toast({
        title: "Error",
        description: "Please select a student first.",
        variant: "destructive"
      });
      return;
    }
    uploadMutation.mutate(data);
  };

  const handleEdit = (document: Document) => {
    setEditingDocument(document);
    editForm.reset({
      title: document.title,
      description: document.description || "",
      documentType: document.documentType,
      isPublic: document.isPublic
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = (data: z.infer<typeof editFormSchema>) => {
    if (editingDocument) {
      console.log("Edit form data:", data);
      console.log("Editing document ID:", editingDocument.id);
      editMutation.mutate({ ...data, id: editingDocument.id });
    }
  };

  const handleDownload = (document: Document) => {
    window.open(`/api/documents/download/${document.id}`, '_blank');
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteMutation.mutate(id);
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    }
    return <FileText className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const selectedStudent = students.find(s => s.id.toString() === selectedStudentId);

  // Filter and sort documents
  const filteredAndSortedDocuments = React.useMemo(() => {
    let result = [...documents];
    
    // Apply filter
    if (selectedDocumentType !== "all") {
      result = result.filter(doc => doc.documentType === selectedDocumentType);
    }
    
    // Apply sort
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  }, [documents, selectedDocumentType, sortOrder]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Student Documents</h1>
          <p className="text-muted-foreground">
            View and manage student documents
          </p>
        </div>
        
        {selectedStudentId && (
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Upload a document for {selectedStudent?.user?.firstName} {selectedStudent?.user?.lastName}
                </DialogDescription>
              </DialogHeader>
              <Form {...uploadForm}>
                <form onSubmit={uploadForm.handleSubmit(handleUpload)} className="space-y-4">
                  <FormField
                    control={uploadForm.control}
                    name="file"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>File</FormLabel>
                        <FormControl>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif"
                            onChange={(e) => field.onChange(e.target.files)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={uploadForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Document title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={uploadForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Document description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={uploadForm.control}
                    name="documentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Document Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select document type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {documentTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={uploadForm.control}
                    name="studentId"
                    render={({ field }) => (
                      <Input type="hidden" {...field} value={selectedStudentId} />
                    )}
                  />
                  <FormField
                    control={uploadForm.control}
                    name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Visible to student
                          </FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Allow the student to view this document
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setUploadDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={uploadMutation.isPending}
                    >
                      {uploadMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Student Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
          <CardDescription>
            Choose a student to view their documents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId} data-testid="select-student">
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a student" />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id.toString()}>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>
                      {student.user?.firstName} {student.user?.lastName} ({student.user?.email})
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Filter and Sort Controls */}
      {selectedStudentId && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filter & Sort</CardTitle>
            <CardDescription>
              Filter by document type and sort by date
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Document Type</label>
                <Select value={selectedDocumentType} onValueChange={setSelectedDocumentType} data-testid="filter-document-type">
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {documentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-sm font-medium mb-2 block">Sort by Date</label>
                <Select value={sortOrder} onValueChange={setSortOrder} data-testid="sort-by-date">
                  <SelectTrigger>
                    <SelectValue placeholder="Newest First" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(selectedDocumentType !== "all" || sortOrder !== "newest") && (
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setSelectedDocumentType("all");
                      setSortOrder("newest");
                    }}
                    data-testid="button-clear-filters"
                  >
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredAndSortedDocuments.length} of {documents.length} document{documents.length !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents List */}
      {selectedStudentId && (
        <div className="grid gap-4">
          {isLoading ? (
            <div data-testid="loading-documents">Loading documents...</div>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium" data-testid="no-documents-found">No documents found</p>
                <p className="text-muted-foreground mb-4">
                  This student hasn't uploaded any documents yet
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </CardContent>
            </Card>
          ) : filteredAndSortedDocuments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium" data-testid="no-documents-match-filter">No documents match your filters</p>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your filter criteria
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedDocumentType("all");
                    setSortOrder("newest");
                  }}
                >
                  Clear Filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredAndSortedDocuments.map((document: Document) => (
              <Card key={document.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      {getFileIcon(document.mimeType)}
                      <div>
                        <CardTitle className="text-lg">{document.title}</CardTitle>
                        <CardDescription>
                          {document.description && (
                            <span className="block">{document.description}</span>
                          )}
                          <span className="text-xs">
                            {document.fileName} • {formatFileSize(document.fileSize)} • 
                            Uploaded {formatDate(document.createdAt)} by {document.uploadedBy}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={document.isPublic ? "default" : "secondary"}>
                        {document.isPublic ? "Visible to Student" : "Hidden from Student"}
                      </Badge>
                      <Badge variant="outline">
                        {documentTypes.find(t => t.value === document.documentType)?.label || document.documentType}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(document)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(document)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(document.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update document information
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Document title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Document description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="documentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Document Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select document type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {documentTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visible to student</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "true")} 
                      value={field.value ? "true" : "false"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select visibility option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">
                          Visible to Student
                        </SelectItem>
                        <SelectItem value="false">
                          Hidden from Student
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-sm text-muted-foreground">
                      Choose whether to allow the student to view this document
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editMutation.isPending}
                >
                  {editMutation.isPending ? "Updating..." : "Update"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}