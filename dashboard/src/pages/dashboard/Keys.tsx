import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import {
  createVirtualKey,
  listVirtualKeys,
  revokeVirtualKey,
} from "@/hooks/use-api-keys";

export default function Keys() {
  const { user, controlPlaneConfigured } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  const rows = useQuery({
    queryKey: ["virtual_keys"],
    queryFn: listVirtualKeys,
  });
  const create = useMutation({
    mutationFn: () => createVirtualKey(user?.id ?? null, name.trim() || "default"),
    onSuccess: ({ secret, error }) => {
      if (error) return toast.error(error);
      setSecret(secret);
      setOpen(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["virtual_keys"] });
      toast.success("Key created — copy it now, it is shown once.");
    },
  });
  const revoke = useMutation({
    mutationFn: revokeVirtualKey,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["virtual_keys"] });
      toast.success("Key revoked. Wings drop it within 60s.");
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">
            Virtual keys hash to the control plane — {controlPlaneConfigured ? "stored hashed, shown once" : "demo store (hash only, in-memory)"}.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> New key
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Limits</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows.data ?? []).map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell>
                    <code className="text-xs text-primary">{k.prefix}…</code>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {k.rpm} rpm · {k.daily_cap}/day
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(k.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => revoke.mutate(k.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    <KeyRound className="mx-auto mb-3 h-8 w-8 opacity-50" />
                    No keys yet — the endpoint answers without one in local mode.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mint a virtual key</DialogTitle>
            <DialogDescription>
              Default limits: 20 rpm · 2,000 req/day per key.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="dex, babysitter, hackathon…"
              />
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Create
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(secret)} onOpenChange={(o) => !o && setSecret(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your new key</DialogTitle>
            <DialogDescription>
              Shown once. The panel only keeps a hash + prefix.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-md border bg-background p-3 text-xs">
              {secret}
            </code>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                navigator.clipboard.writeText(secret ?? "");
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </div>
          <Badge variant="secondary" className="w-fit font-mono text-[10px]">
            send as: Authorization: Bearer &lt;key&gt;
          </Badge>
        </DialogContent>
      </Dialog>
    </div>
  );
}
