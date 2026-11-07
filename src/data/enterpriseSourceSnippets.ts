import { SourceEvidence, GraphEdge, GraphNode } from '../types/index';

function resolveId(endpoint: string | GraphNode): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id;
}

// Curated realistic source snippets for key enterprise edges
const ENTERPRISE_SNIPPET_DB: Record<
  string,
  {
    callerName: string;
    callerPath: string;
    calleeName: string;
    calleePath: string;
    lineNumber: number;
    statement: string;
    relationship: string;
    explanation: string;
    code: string;
  }
> = {
  // BillingOrchestrator -> InvoiceBatchProcessor
  'node-1-1->node-1-2': {
    callerName: 'BillingOrchestrator',
    callerPath: 'src/main/java/com/acme/legacy/billing/BillingOrchestrator.java',
    calleeName: 'InvoiceBatchProcessor',
    calleePath: 'src/main/java/com/acme/legacy/billing/InvoiceBatchProcessor.java',
    lineNumber: 48,
    statement: 'BatchExecutionResult batchResult = invoiceProcessor.dispatchNightlyInvoices(billingCycle);',
    relationship: 'calls method dispatchNightlyInvoices(BillingCycle)',
    explanation: 'BillingOrchestrator delegates nightly invoice calculation and generation to InvoiceBatchProcessor.',
    code: `package com.acme.legacy.billing;

import java.time.LocalDate;
import java.util.List;

public class BillingOrchestrator {
    private final InvoiceBatchProcessor invoiceProcessor;
    private final TariffLookupService tariffService;

    public BillingOrchestrator(InvoiceBatchProcessor invoiceProcessor, TariffLookupService tariffService) {
        this.invoiceProcessor = invoiceProcessor;
        this.tariffService = tariffService;
    }

    public void runMonthlySettlement(LocalDate cutoffDate) {
        BillingCycle billingCycle = BillingCycle.of(cutoffDate);
        
        // Dispatch batch invoice calculation across active customer accounts
        BatchExecutionResult batchResult = invoiceProcessor.dispatchNightlyInvoices(billingCycle);
        if (!batchResult.isSuccessful()) {
            throw new BillingException("Batch invoicing failed for cycle: " + billingCycle);
        }
    }
}`,
  },
  // SessionTokenVault -> OAuthGrantValidator
  'node-2-2->node-2-4': {
    callerName: 'SessionTokenVault',
    callerPath: 'src/main/java/com/acme/legacy/security/SessionTokenVault.java',
    calleeName: 'OAuthGrantValidator',
    calleePath: 'src/main/java/com/acme/legacy/security/OAuthGrantValidator.java',
    lineNumber: 52,
    statement: 'GrantValidationResult grant = grantValidator.validateGrantToken(storedToken.getAuthCode());',
    relationship: 'calls method validateGrantToken(String)',
    explanation: 'SessionTokenVault verifies authorization grant claims with OAuthGrantValidator before renewing sessions.',
    code: `package com.acme.legacy.security;

import java.util.Optional;

public class SessionTokenVault {
    private final OAuthGrantValidator grantValidator;
    private final CipherKeyRotator keyRotator;

    public SessionTokenVault(OAuthGrantValidator grantValidator, CipherKeyRotator keyRotator) {
        this.grantValidator = grantValidator;
        this.keyRotator = keyRotator;
    }

    public SessionClaim acquireSession(String sessionId) {
        StoredSessionToken storedToken = findById(sessionId);
        if (storedToken == null) {
            throw new SecurityException("Session identifier not found in vault");
        }

        // Validate underlying OAuth grant before emitting session claims
        GrantValidationResult grant = grantValidator.validateGrantToken(storedToken.getAuthCode());
        return new SessionClaim(storedToken.getSubject(), grant.getGrantedScopes());
    }
}`,
  },
};

export function getEnterpriseSourceEvidence(
  edge: GraphEdge,
  nodesById: Map<string, GraphNode>
): SourceEvidence | null {
  const sId = resolveId(edge.source);
  const tId = resolveId(edge.target);
  const key = `${sId}->${tId}`;

  const entry = ENTERPRISE_SNIPPET_DB[key];
  if (!entry) {
    // Return null: never invent fake source lines!
    return null;
  }

  const lines = entry.code.split('\n');
  const surroundingCode = lines.map((text, idx) => ({
    line: idx + 35, // realistic offset
    text,
    isCallSite: idx + 35 === entry.lineNumber,
  }));

  const sourceNode = nodesById.get(sId);
  const targetNode = nodesById.get(tId);

  return {
    edgeId: edge.id,
    callerId: sId,
    callerName: sourceNode?.name || entry.callerName,
    callerPath: sourceNode?.path || entry.callerPath,
    calleeId: tId,
    calleeName: targetNode?.name || entry.calleeName,
    calleePath: targetNode?.path || entry.calleePath,
    lineNumber: entry.lineNumber,
    statement: entry.statement,
    relationship: entry.relationship,
    explanation: entry.explanation,
    surroundingCode,
  };
}
