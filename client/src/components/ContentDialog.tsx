import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContentSchema, type InsertContent, type Content } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface ContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: Content | null;
  onSubmit: (data: InsertContent) => void;
  isPending: boolean;
}

export function ContentDialog({
  open,
  onOpenChange,
  content,
  onSubmit,
  isPending,
}: ContentDialogProps) {
  const isEditing = !!content;

  const form = useForm<InsertContent>({
    resolver: zodResolver(insertContentSchema.omit({ authorId: true })),
    defaultValues: content
      ? {
          title: content.title,
          description: content.description ?? "",
          body: content.body ?? "",
          imageUrl: content.imageUrl ?? "",
          category: content.category,
          published: content.published,
        }
      : {
          title: "",
          description: "",
          body: "",
          imageUrl: "",
          category: "general",
          published: false,
        },
  });

  const handleSubmit = (data: InsertContent) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="dialog-content-title">
            {isEditing ? "Edit Content" : "Create Content"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the content details below."
              : "Fill in the details to create new content."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter content title"
                      {...field}
                      data-testid="input-content-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-content-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="feature">Feature</SelectItem>
                      <SelectItem value="testimonial">Testimonial</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the content"
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-content-description"
                    />
                  </FormControl>
                  <FormDescription>
                    A short summary that appears in previews
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Main content body"
                      rows={8}
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-content-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://example.com/image.jpg"
                      {...field}
                      value={field.value ?? ""}
                      data-testid="input-content-image-url"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional image for the content
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="published"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Published</FormLabel>
                    <FormDescription>
                      Make this content visible to the public
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-content-published"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-content"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-submit-content"
              >
                {isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update Content"
                  : "Create Content"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
