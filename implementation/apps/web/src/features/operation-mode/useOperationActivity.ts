import { useQuery } from "@powersync/react";
import { operationActivitySql } from "../../lib/powersync/operation-journal";
import type { OperationActivity } from "./workspace-model";

export function useOperationActivity(companyId: string): readonly OperationActivity[] {
  const { data } = useQuery<OperationActivity>(
    `SELECT o.*, d.error_message FROM (${operationActivitySql}) o
     LEFT JOIN upload_dead_letters d ON d.source_table = 'operation_commands' AND d.source_record_id = o.id AND d.status = 'pending_review'
     WHERE o.company_id = ? ORDER BY o.created_at DESC LIMIT 80`,
    [companyId],
  );
  return data;
}
