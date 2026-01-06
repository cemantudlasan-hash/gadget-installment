
"use client";

import { useState } from "react";
import { useFirebase } from "@/lib/firebase/context";
import { collection, doc, updateDoc, deleteDoc } from "firebase/firestore";
import GadgetPostForm from "./gadget-post-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { GadgetPost } from "@/types";
import { PlusCircle, Edit, Trash2, PackageCheck, Package, ExternalLink, Tag, Wallet, Calendar, Repeat } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Image from "next/image";
import { Badge } from "./ui/badge";

interface GadgetPostsSectionProps {
  posts: GadgetPost[];
  loading: boolean;
  onDataChange: () => void;
  userRole: 'admin' | 'guest';
}

export default function GadgetPostsSection({ posts, loading, onDataChange, userRole }: GadgetPostsSectionProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  
  const [editingPost, setEditingPost] = useState<GadgetPost | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleSaveSuccess = () => {
    setShowForm(false);
    setEditingPost(null);
    onDataChange();
  };

  const handleDeletePost = async (postId: string) => {
    if (!db || userRole !== 'admin') {
      toast({ variant: "destructive", title: "Permission Denied", description: "You cannot delete posts." });
      return;
    }
    try {
      await deleteDoc(doc(db, "gadgetPosts", postId));
      toast({ title: "Success", description: "Post deleted successfully!" });
      onDataChange();
    } catch (e: any) {
      console.error("Error deleting post:", e);
      toast({ variant: "destructive", title: "Error", description: `Error deleting post: ${e.message}` });
    }
  };

  const handleToggleSold = async (post: GadgetPost) => {
    if (!db || userRole !== 'admin') {
      toast({ variant: "destructive", title: "Permission Denied", description: "You cannot change post status." });
      return;
    }
    try {
      const postRef = doc(db, "gadgetPosts", post.id);
      await updateDoc(postRef, { isSold: !post.isSold });
      toast({ title: "Status Updated", description: `${post.productName} marked as ${!post.isSold ? 'Sold' : 'Available'}.` });
      onDataChange();
    } catch (e: any) {
       console.error("Error updating status:", e);
       toast({ variant: "destructive", title: "Error", description: `Could not update status: ${e.message}` });
    }
  };

  const handleEditPost = (post: GadgetPost) => {
    setEditingPost(post);
    setShowForm(true);
  };
  
  const handleAddNewPost = () => {
    setEditingPost(null);
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setEditingPost(null);
    setShowForm(false);
  };

  if (showForm) {
    return <GadgetPostForm onSaveSuccess={handleSaveSuccess} initialData={editingPost} onCancel={handleCancelForm} />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Manage Gadget Posts</CardTitle>
            <CardDescription>Create, edit, and manage your gadget listings for the guest page.</CardDescription>
          </div>
          <Button onClick={handleAddNewPost} disabled={userRole !== 'admin'}>
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Post
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-96 w-full" />)}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No gadget posts yet.</p>
            <Button onClick={handleAddNewPost} className="mt-4" disabled={userRole !== 'admin'}>Create Your First Post</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Card key={post.id} className="overflow-hidden relative flex flex-col">
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                    <Badge variant={post.isSold ? "destructive" : "default"}>
                        {post.isSold ? "Sold" : "Available"}
                    </Badge>
                </div>
                 <div className="relative w-full h-48 bg-muted flex items-center justify-center">
                    {post.imageUrl ? (
                        <Image src={post.imageUrl} alt={post.productName} layout="fill" objectFit="cover" className="bg-muted" />
                    ) : (
                        <Package className="h-16 w-16 text-muted-foreground" />
                    )}
                 </div>
                <div className="p-4 flex-grow flex flex-col">
                  <h3 className="font-bold text-lg">{post.productName}</h3>
                  <p className="text-xs text-muted-foreground mb-2">P/N: {post.productNumber}</p>
                   <div className="font-bold text-primary text-lg my-2 flex items-center">
                     <Tag className="mr-2 h-5 w-5" />
                     ฿{(post.price || 0).toLocaleString()}
                   </div>
                  <p className="text-sm text-muted-foreground my-2 flex-grow">{post.description}</p>
                  
                  {(post.downPayment || 0) > 0 && (
                    <div className="mt-2 space-y-2 text-sm border-t pt-3">
                        <p className="flex items-center gap-2"><Wallet className="w-4 h-4 text-muted-foreground"/> <strong>Down Payment:</strong> ฿{(post.downPayment || 0).toLocaleString()}</p>
                        <p className="flex items-center gap-2"><Calendar className="w-4 h-4 text-muted-foreground"/> <strong>Months:</strong> {post.installmentMonths || 0}</p>
                        <p className="flex items-center gap-2"><Repeat className="w-4 h-4 text-muted-foreground"/> <strong>Monthly:</strong> ฿{(post.monthlyInstallment || 0).toLocaleString()}</p>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground mt-4 border-t pt-3 space-y-1">
                     <p><strong>Seller:</strong> {post.adminName}</p>
                     <p><strong>Contact:</strong> {post.contactNumber}</p>
                     <p><strong>Socials:</strong> {post.socialMedia}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => handleToggleSold(post)} className="w-full" disabled={userRole !== 'admin'}>
                        {post.isSold ? <Package className="mr-2"/> : <PackageCheck className="mr-2"/>}
                        {post.isSold ? 'Mark as Available' : 'Mark as Sold'}
                    </Button>
                    {post.externalLink && (
                        <a href={post.externalLink} target="_blank" rel="noopener noreferrer" className="w-full">
                            <Button variant="outline" className="w-full">
                                <ExternalLink className="mr-2 h-4 w-4"/> View Photos
                            </Button>
                        </a>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEditPost(post)} disabled={userRole !== 'admin'}><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={userRole !== 'admin'}><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete this post?</AlertDialogTitle><AlertDialogDescription>This will permanently remove the post for "{post.productName}".</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeletePost(post.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
