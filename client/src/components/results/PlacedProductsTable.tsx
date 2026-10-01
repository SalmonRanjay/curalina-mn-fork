import { useMutation } from "@tanstack/react-query";
import { Check, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  RenderProductPlacement,
  RenderRecommendationSummary,
} from "@shared/render-placements";

function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    minorUnits / 100
  );
}

const TIER_LABEL: Record<RenderProductPlacement["tier"], string> = {
  foundation: "Foundation",
  bridge: "Bridge",
  accent: "Accent",
};

/**
 * The products the recommender placed in this room (ADR-0025), one row per
 * Design Manual slot, each cartable at its placed quantity.
 */
export function PlacedProductsTable({
  placements,
  summary,
  sessionId,
}: {
  placements: RenderProductPlacement[];
  summary: RenderRecommendationSummary | null;
  sessionId: string | null;
}) {
  const { toast } = useToast();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const currency = summary?.currency ?? placements[0]?.currency ?? "CAD";

  const addMutation = useMutation({
    mutationFn: async (items: RenderProductPlacement[]) => {
      for (const item of items) {
        await apiRequest("POST", "/api/cart", {
          sessionId,
          productId: item.appProductId,
          quantity: item.quantity,
        });
      }
      return items;
    },
    onSuccess: (items) => {
      setAdded((prev) => new Set([...Array.from(prev), ...items.map((i) => i.slotId)]));
      queryClient.invalidateQueries({ queryKey: ["/api/cart", sessionId] });
      toast({
        title: items.length === 1 ? "Added to cart" : `Added ${items.length} pieces to cart`,
        description: items.length === 1 ? items[0].name : "Every placed piece is in your cart.",
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to cart", variant: "destructive" });
    },
  });

  const total = placements.reduce((sum, p) => sum + p.lineTotalMinorUnits, 0);
  const notYetAdded = placements.filter((p) => !added.has(p.slotId));

  return (
    <Card className="p-4 mt-6" data-testid="card-placed-products">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold" style={{ fontSize: "var(--font-size-xl)" }} data-testid="heading-placed-products">
            Products placed in this room
          </h2>
          <p className="text-sm text-muted-foreground">
            Recommended from the supplier catalogue for your answers
            {summary?.planSource ? ` · room plan: ${summary.planSource}` : ""}
          </p>
        </div>
        {placements.length > 0 && (
          <Button
            onClick={() => addMutation.mutate(notYetAdded)}
            disabled={!sessionId || notYetAdded.length === 0 || addMutation.isPending}
            data-testid="button-add-all-to-cart"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {notYetAdded.length === 0 ? "All in cart" : "Add all to cart"}
          </Button>
        )}
      </div>

      {placements.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-placements">
          No catalogue products could be placed for these answers.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table data-testid="table-placed-products">
            <TableHeader>
              <TableRow>
                <TableHead>Piece</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Match</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map((p) => (
                <TableRow key={p.slotId} data-testid={`row-placement-${p.slotId}`}>
                  <TableCell>
                    <div className="font-medium">{p.label}</div>
                    <div className="text-xs text-muted-foreground">{TIER_LABEL[p.tier]}</div>
                  </TableCell>
                  <TableCell>
                    <div>{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.category}</div>
                  </TableCell>
                  <TableCell>{p.supplier}</TableCell>
                  <TableCell className="text-right">{p.quantity}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div>{formatMoney(p.lineTotalMinorUnits, p.currency)}</div>
                    {p.quantity > 1 && (
                      <div className="text-xs text-muted-foreground">
                        {formatMoney(p.unitPriceMinorUnits, p.currency)} each
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span data-testid={`text-match-${p.slotId}`}>{Math.round(p.matchScore * 100)}%</span>
                    {!p.ruleMatch && (
                      <Badge variant="outline" className="ml-2" title="The style rules disagree with the model for this piece">
                        check
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={added.has(p.slotId) ? "secondary" : "outline"}
                      onClick={() => addMutation.mutate([p])}
                      disabled={!sessionId || added.has(p.slotId) || addMutation.isPending}
                      data-testid={`button-add-placement-${p.slotId}`}
                    >
                      {added.has(p.slotId) ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-medium">
                  Room total
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap" data-testid="text-placed-total">
                  {formatMoney(total, currency)}
                </TableCell>
                <TableCell colSpan={2} className="text-right text-xs text-muted-foreground">
                  {summary?.budgetCeilingMinorUnits != null
                    ? `of ${formatMoney(summary.budgetCeilingMinorUnits, currency)} budget`
                    : "no budget ceiling"}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}

      {summary && (summary.notes.length > 0 || summary.notInCatalogue.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground" data-testid="list-placement-notes">
          {summary.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
          {summary.notInCatalogue.length > 0 && (
            <li>Not in the catalogue yet: {summary.notInCatalogue.join(", ")}.</li>
          )}
        </ul>
      )}
    </Card>
  );
}
