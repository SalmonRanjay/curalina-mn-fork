import React from "react";
import { Switch, Route } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/pages/admin";
import AdminProducts from "@/pages/admin/products";
import AdminCsvImport from "@/pages/admin/csv-import";
import AdminBulkUpload from "@/pages/admin/bulk-upload";
import AdminFrontViewUpload from "@/pages/admin/front-view-upload";
import AdminS3Sync from "@/pages/admin/s3-sync";
import AdminS3ImageRenamer from "@/pages/admin/s3-image-renamer";
import AdminVisualDescriptions from "@/pages/admin/visual-descriptions";
import AdminSuppliers from "@/pages/admin/suppliers";
import AdminOrders from "@/pages/admin/orders";
import AdminUsers from "@/pages/admin/users";
import AdminSettings from "@/pages/admin/settings";
import AdminTraining from "@/pages/admin/training";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminBlog from "@/pages/admin/blog";
import AdminContent from "@/pages/admin/content";
import AdminRendersStorage from "@/pages/admin/renders-storage";
import AdminDocumentation from "@/pages/admin/documentation";
import AdminMappingAnalysis from "@/pages/admin/mapping-analysis";
import AnalysisDashboard from "@/pages/admin/analysis-dashboard";

export function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/products" component={AdminProducts} />
        <Route path="/admin/products/csv-import" component={AdminCsvImport} />
        <Route path="/admin/products/bulk-upload" component={AdminBulkUpload} />
        <Route path="/admin/products/front-view-upload" component={AdminFrontViewUpload} />
        <Route path="/admin/products/s3-sync" component={AdminS3Sync} />
        <Route path="/admin/products/s3-image-renamer" component={AdminS3ImageRenamer} />
        <Route path="/admin/products/visual-descriptions" component={AdminVisualDescriptions} />
        <Route path="/admin/suppliers" component={AdminSuppliers} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/settings" component={AdminSettings} />
        <Route path="/admin/training" component={AdminTraining} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route path="/admin/blog" component={AdminBlog} />
        <Route path="/admin/content" component={AdminContent} />
        <Route path="/admin/renders-storage" component={AdminRendersStorage} />
        <Route path="/admin/documentation" component={AdminDocumentation} />
        <Route path="/admin/mapping-analysis" component={AdminMappingAnalysis} />
        <Route path="/admin/analysis" component={AnalysisDashboard} />
      </Switch>
    </AdminLayout>
  );
}
