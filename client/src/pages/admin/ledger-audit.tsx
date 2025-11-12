import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, Lock, Unlock, Calendar, Package } from "lucide-react";
import type { SelectionLedger } from "@shared/schema";

export default function LedgerAudit() {
  const [selectedLedger, setSelectedLedger] = useState<SelectionLedger | null>(null);

  const { data: ledgers, isLoading } = useQuery<SelectionLedger[]>({
    queryKey: ["/api/admin/ledgers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/ledgers?limit=100");
      if (!res.ok) throw new Error("Failed to fetch ledgers");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Selection Ledger Audit</h1>
          <p className="text-muted-foreground">Loading ledgers...</p>
        </div>
      </div>
    );
  }

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-ledger-audit">
          Selection Ledger Audit
        </h1>
        <p className="text-muted-foreground">
          View full decision trail for AI product selection
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Selection Ledgers</CardTitle>
          <CardDescription>
            Audit trail showing how products were selected for each render
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ledgers || ledgers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No selection ledgers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Render ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgers.map((ledger) => (
                  <TableRow key={ledger.id} data-testid={`row-ledger-${ledger.id}`}>
                    <TableCell className="font-mono text-xs">
                      {ledger.renderId.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 opacity-50" />
                        {formatDate(ledger.createdAt!)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {ledger.lockedAt ? (
                        <Badge variant="default" className="gap-1">
                          <Lock className="w-3 h-3" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Unlock className="w-3 h-3" />
                          Unlocked
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 opacity-50" />
                        {ledger.compositionOrder?.length || 0} products
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLedger(ledger)}
                        data-testid={`button-view-${ledger.id}`}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Ledger Details Dialog */}
      <Dialog open={!!selectedLedger} onOpenChange={() => setSelectedLedger(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Selection Ledger Details</DialogTitle>
            <DialogDescription>
              Complete audit trail for render {selectedLedger?.renderId.substring(0, 12)}...
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[70vh]">
            {selectedLedger && (
              <div className="space-y-6 pr-4">
                {/* Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Render ID</p>
                        <p className="font-mono text-xs">{selectedLedger.renderId}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Selection Hash</p>
                        <p className="font-mono text-xs">{selectedLedger.selectionHash}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Created</p>
                        <p className="text-sm">{formatDate(selectedLedger.createdAt!)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Locked</p>
                        <p className="text-sm">{formatDate(selectedLedger.lockedAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Composition Order */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Composition Order</CardTitle>
                    <CardDescription>
                      Products ordered by priority (essentials → complementary → decor)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {selectedLedger.compositionOrder?.map((sku, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="w-12 justify-center">
                            {index + 1}
                          </Badge>
                          <span className="font-mono">{sku}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Selection Rationale */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selection Rationale</CardTitle>
                    <CardDescription>
                      Category-level decision trail
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
                      {JSON.stringify(selectedLedger.selectionRationale, null, 2)}
                    </pre>
                  </CardContent>
                </Card>

                {/* Candidate Pool Snapshot */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Candidate Pool Snapshot</CardTitle>
                    <CardDescription>
                      All products available at selection time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {Array.isArray(selectedLedger.candidatePoolSnapshot) 
                        ? selectedLedger.candidatePoolSnapshot.length 
                        : 0} products in candidate pool
                    </p>
                    <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto max-h-60">
                      {JSON.stringify(selectedLedger.candidatePoolSnapshot, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
