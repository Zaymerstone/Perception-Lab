import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Download, LogOut, Eye, RefreshCw } from "lucide-react";
import type { Json } from "@/integrations/supabase/types";

const ALLOWED_EMAIL = "egor.nesterov1222@gmail.com";

interface ExperimentRow {
  id: string;
  created_at: string;
  participant_age: string | null;
  participant_gender: string | null;
  participant_vision: string | null;
  subject_code: string | null;
  block_number: number | null;
  experiment_type: string | null;
  raw_data_string: string | null;
  metadata: Json | null;
}

export default function Admin() {
  const [rows, setRows] = useState<ExperimentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Auth guard
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session || session.user.email?.toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
        navigate("/admin/login", { replace: true });
      } else {
        setAuthed(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || session.user.email?.toLowerCase() !== ALLOWED_EMAIL.toLowerCase()) {
        navigate("/admin/login", { replace: true });
      } else {
        setAuthed(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("experiment_results")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRows((data as ExperimentRow[]) ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    if (authed) fetchData();
  }, [authed, fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  // CSV generation
  const downloadCSV = () => {
    if (rows.length === 0) return;

    const headers = [
      "id",
      "created_at",
      "subject_code",
      "block_number",
      "participant_age",
      "participant_gender",
      "participant_vision",
      "experiment_type",
      "raw_data_string",
      "metadata",
    ];

    const escape = (v: string | null | undefined) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };

    const csvRows = [headers.join(",")];
    for (const r of rows) {
      csvRows.push(
        [
          escape(r.id),
          escape(r.created_at),
          escape(r.subject_code),
          escape(r.block_number?.toString()),
          escape(r.participant_age),
          escape(r.participant_gender),
          escape(r.participant_vision),
          escape(r.experiment_type),
          escape(r.raw_data_string),
          escape(r.metadata ? JSON.stringify(r.metadata) : null),
        ].join(",")
      );
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `experiment_results_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authed) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Experiment Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              {rows.length} result{rows.length !== 1 && "s"} collected
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="default" size="sm" onClick={downloadCSV} disabled={rows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download All Data
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Results</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Subject Code</TableHead>
                    <TableHead>Block #</TableHead>
                    <TableHead>Age</TableHead>
                    <TableHead>Gender</TableHead>
                    <TableHead>Experiment</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                        No experiment results yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(r.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{r.subject_code ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.block_number ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.participant_age ?? "—"}</TableCell>
                      <TableCell className="text-sm capitalize">{r.participant_gender ?? "—"}</TableCell>
                      <TableCell>
                        <span className="inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary uppercase">
                          {r.experiment_type ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Eye className="mr-1 h-4 w-4" /> View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Trial Details — {r.experiment_type?.toUpperCase()}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Metadata</p>
                                <ScrollArea className="h-40 rounded-md border p-3">
                                  <pre className="text-xs text-foreground whitespace-pre-wrap">
                                    {r.metadata ? JSON.stringify(r.metadata, null, 2) : "None"}
                                  </pre>
                                </ScrollArea>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-muted-foreground mb-1">Raw Data</p>
                                <ScrollArea className="h-48 rounded-md border p-3">
                                  <pre className="text-xs text-foreground whitespace-pre-wrap">
                                    {r.raw_data_string || "No data"}
                                  </pre>
                                </ScrollArea>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
