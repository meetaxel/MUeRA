import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { actions, setState, useStore } from "@/lib/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Settings & Privacy — MUeRA" },
      { name: "description", content: "Manage demo data, reminders and delete your MUeRA data." },
      { property: "og:title", content: "Settings & Privacy — MUeRA" },
      { property: "og:description", content: "Your data stays on your device." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const s = useStore();
  const [perm, setPerm] = useState("unsupported");
  useEffect(() => {
    setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);
  return (
    <div className="space-y-6">
      <PageHeader title="Settings & Privacy" />
      <section className="space-y-2">
        <Label htmlFor="attendance-target">Attendance target (%)</Label>
        <Input
          id="attendance-target"
          aria-label="Attendance target"
          className="w-40"
          type="number"
          min={1}
          max={100}
          placeholder="75"
          value={s.settings.threshold}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (e.target.value && n >= 1 && n <= 100)
              setState((st) => ({ settings: { ...st.settings, threshold: n } }));
          }}
        />
      </section>
      <section className="card-surface space-y-2 p-4">
        <h2 className="font-bold">Reminders</h2>
        <p className="text-sm text-muted-foreground">
          Reminders pop up while MUeRA is open in a tab. Browser notifications need your permission
          and do not arrive when the app is fully closed.
        </p>
        <p className="text-sm">
          Status: <b>{perm}</b>
        </p>
        <Button
          disabled={perm === "unsupported" || perm === "granted"}
          onClick={async () => setPerm(await Notification.requestPermission())}
        >
          Enable browser notifications
        </Button>
      </section>
      <section className="card-surface space-y-2 p-4">
        <h2 className="font-bold">Your data</h2>
        <p className="text-sm text-muted-foreground">
          Everything is saved only in this browser on this device. Nothing is sent to a server
          except the text you choose to send to the AI. Clearing browser data erases it.
        </p>
        <p className="text-sm">
          {s.tasks.length} items · {s.subjects.length} subjects · {s.docs.length} documents ·{" "}
          {s.aiCalls} AI requests made
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              actions.clearDemo();
              toast.success("Demo data removed");
            }}
          >
            Remove demo data
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              actions.loadDemo();
              toast.success("Demo data loaded");
            }}
          >
            Load demo data
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Delete ALL your MUeRA data on this device?")) {
                actions.wipeAll();
                toast.success("All data deleted");
              }
            }}
          >
            Delete all my data
          </Button>
        </div>
      </section>
    </div>
  );
}
