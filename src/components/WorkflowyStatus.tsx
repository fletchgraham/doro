import { Button } from "@/components/ui/button";
import type { WorkflowySync } from "../hooks/useWorkflowySync";

// The timer page's Workflowy footer: what the last sync did and a button
// to pull again. Settings live in the settings modal.
function WorkflowyStatus({
  sync,
  onOpenSettings,
}: {
  sync: WorkflowySync;
  onOpenSettings: () => void;
}) {
  const { syncNow, syncing, status, error, canSync } = sync;
  return (
    <div
      className="mt-10 pt-4 border-t flex items-center gap-3 flex-wrap text-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-muted-foreground">Workflowy mode</span>
      {canSync ? (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncNow()}
            disabled={syncing}
          >
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          {(error || status) && (
            <span
              className={
                error
                  ? "text-xs text-red-600 dark:text-red-400"
                  : "text-xs text-muted-foreground"
              }
            >
              {error ?? status}
            </span>
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">
          Add your API key and parent node in{" "}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={onOpenSettings}
          >
            Settings
          </button>{" "}
          to sync.
        </span>
      )}
    </div>
  );
}

export default WorkflowyStatus;
