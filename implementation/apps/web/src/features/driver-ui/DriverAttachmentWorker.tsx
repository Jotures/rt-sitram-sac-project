import { usePowerSync } from "@powersync/react";
import { useEffect, useRef } from "react";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import {
  createSupabaseAttachmentGateway,
  OpfsAttachmentBlobSource,
  processNextAttachment,
} from "../../lib/powersync/attachment-worker";
import { usePowerSyncRuntime } from "../../lib/powersync/PowerSyncProvider";
import { useUploadQueue } from "../../lib/powersync/use-upload-queue";
import { getSupabaseClient } from "../../lib/supabase";
import { useIdentity } from "../identity/IdentityProvider";

const WORK_INTERVAL_MS = 15_000;

/**
 * Headless product worker. Mount once inside PowerSyncProvider + IdentityProvider.
 * It uploads one evidence at a time and leaves bounded failures visible in the queue.
 */
export function DriverAttachmentWorker(): null {
  const database = usePowerSync();
  const runtime = usePowerSyncRuntime();
  const identity = useIdentity();
  const network = useNetworkStatus();
  const uploadQueue = useUploadQueue(runtime.sqliteReady);
  const running = useRef(false);

  useEffect(() => {
    if (
      network !== "ONLINE" ||
      !runtime.sqliteReady ||
      identity.state.status !== "READY" ||
      uploadQueue.error !== null ||
      uploadQueue.pending > 0
    ) {
      return;
    }
    const client = getSupabaseClient();
    if (client === null) return;

    let active = true;
    const blobs = new OpfsAttachmentBlobSource();
    const remote = createSupabaseAttachmentGateway(client);
    const companyId = identity.state.identity.company.id;
    const profileId = identity.state.identity.profile.id;

    const tick = async (): Promise<void> => {
      if (!active || running.current) return;
      running.current = true;
      try {
        const result = await processNextAttachment({
          database,
          blobs,
          remote,
          companyId,
          profileId,
        });
        if (result === "UPLOADED" && active) void tick();
      } finally {
        running.current = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => void tick(), WORK_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [
    database,
    identity.state,
    network,
    runtime.sqliteReady,
    uploadQueue.error,
    uploadQueue.pending,
  ]);

  return null;
}
