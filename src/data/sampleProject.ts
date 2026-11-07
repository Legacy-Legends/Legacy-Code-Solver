import { GraphData, SourceEvidence } from '../types/index';

export const SAMPLE_JAVA_SOURCES = {
  checkout: `package com.acme.order;

import com.acme.session.SessionManager;
import com.acme.session.UserSession;
import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;

/**
 * Handles transactional order placement and checkout verification.
 * Direct dependent of SessionManager.
 */
public class CheckoutService {
    private final SessionManager sessionManager;
    private final OrderRepository orderRepository;
    private final PaymentGateway paymentGateway;

    public CheckoutService(
        SessionManager sessionManager,
        OrderRepository orderRepository,
        PaymentGateway paymentGateway
    ) {
        this.sessionManager = sessionManager;
        this.orderRepository = orderRepository;
        this.paymentGateway = paymentGateway;
    }

    /**
     * Verifies user authorization before creating order record.
     */
    public OrderResult processCheckout(String sessionToken, Cart cart) {
        if (sessionToken == null || sessionToken.isBlank()) {
            throw new IllegalArgumentException("Session token is required for checkout");
        }

        // CALL SITE: CheckoutService depends on SessionManager.validateSession
        UserSession session = sessionManager.validateSession(sessionToken);
        if (!session.isActive()) {
            return OrderResult.unauthorized("Expired or invalid session token");
        }

        BigDecimal total = cart.calculateSubtotal();
        PaymentAuth paymentAuth = paymentGateway.authorize(session.getUserId(), total);
        if (!paymentAuth.isApproved()) {
            return OrderResult.declined("Payment authorization failed");
        }

        UUID orderId = UUID.randomUUID();
        Order order = new Order(orderId, session.getUserId(), cart.getItems(), total);
        orderRepository.save(order);

        return OrderResult.success(orderId, order.getCreatedAt());
    }
}`,

  session: `package com.acme.session;

import com.acme.auth.AuthTokenValidator;
import com.acme.auth.TokenValidationResult;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Manages active user sessions, token expiry, and authentication state.
 * Direct caller of AuthTokenValidator.
 */
public class SessionManager {
    private final AuthTokenValidator tokenValidator;
    private final Map<String, UserSession> sessionCache = new ConcurrentHashMap<>();

    public SessionManager(AuthTokenValidator tokenValidator) {
        this.tokenValidator = tokenValidator;
    }

    /**
     * Resolves session token to an active UserSession.
     * Calls central AuthTokenValidator for cryptographic signature verification.
     */
    public UserSession validateSession(String rawToken) {
        UserSession cached = sessionCache.get(rawToken);
        if (cached != null && cached.getExpiresAt().isAfter(Instant.now())) {
            return cached;
        }

        // CALL SITE: SessionManager depends on AuthTokenValidator.verifyToken
        TokenValidationResult result = tokenValidator.verifyToken(rawToken);
        if (!result.isValid()) {
            throw new SecurityException("Token verification rejected: " + result.getReason());
        }

        UserSession newSession = new UserSession(
            result.getUserId(),
            result.getRoles(),
            Instant.now().plusSeconds(3600)
        );
        sessionCache.put(rawToken, newSession);
        return newSession;
    }

    public void invalidate(String rawToken) {
        sessionCache.remove(rawToken);
    }
}`,

  auth: `package com.acme.auth;

import java.security.PublicKey;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentSkipListSet;

/**
 * Core security service verifying JWT cryptographic signatures and claims.
 * If changed, affects SessionManager (direct) and CheckoutService (indirect).
 */
public class AuthTokenValidator {
    private final PublicKey jwtPublicKey;
    private final Set<String> revokedTokenIds = new ConcurrentSkipListSet<>();

    public AuthTokenValidator(PublicKey jwtPublicKey) {
        this.jwtPublicKey = jwtPublicKey;
    }

    /**
     * Cryptographically validates JWT token and extracts user security claims.
     */
    public TokenValidationResult verifyToken(String rawToken) {
        if (rawToken == null || rawToken.isEmpty()) {
            return TokenValidationResult.invalid("Empty bearer credentials");
        }

        ParsedJwt jwt = JwtParser.parse(rawToken, jwtPublicKey);
        if (jwt.getExpiration().isBefore(Instant.now())) {
            return TokenValidationResult.invalid("Token signature expired");
        }

        if (revokedTokenIds.contains(jwt.getTokenId())) {
            return TokenValidationResult.invalid("Token revoked by identity provider");
        }

        return TokenValidationResult.valid(jwt.getSubject(), jwt.getScopes());
    }

    public void revoke(String tokenId) {
        revokedTokenIds.add(tokenId);
    }
}`,

  logger: `package com.acme.logging;

import java.time.Instant;
import java.time.format.DateTimeFormatter;

/**
 * Isolated infrastructure utility for structured application logging.
 * Independent component: zero callers or dependents in this project graph.
 */
public class AppLogger {
    private final String componentName;
    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ISO_INSTANT;

    public AppLogger(Class<?> targetClass) {
        this.componentName = targetClass.getSimpleName();
    }

    public void info(String message) {
        emit("INFO", message, null);
    }

    public void warn(String message) {
        emit("WARN", message, null);
    }

    public void error(String message, Throwable cause) {
        emit("ERROR", message, cause);
    }

    private void emit(String level, String message, Throwable cause) {
        String timestamp = FORMATTER.format(Instant.now());
        System.out.println(timestamp + " [" + level + "] [" + componentName + "] " + message);
        if (cause != null) {
            cause.printStackTrace(System.err);
        }
    }
}`
};

function parseSurroundingCode(
  source: string,
  targetLine: number,
  paddingBefore: number = 6,
  paddingAfter: number = 10
) {
  const lines = source.split('\n');
  const start = Math.max(1, targetLine - paddingBefore);
  const end = Math.min(lines.length, targetLine + paddingAfter);

  const result = [];
  for (let i = start; i <= end; i++) {
    result.push({
      line: i,
      text: lines[i - 1],
      isCallSite: i === targetLine,
    });
  }
  return result;
}

export const SAMPLE_GRAPH_DATA: GraphData = {
  overallHealth: 84,
  clusters: [
    {
      id: 'cluster-order',
      name: 'Order Processing',
      packagePath: 'src/main/java/com/acme/order',
      anchor: { x: -80, y: 30, z: 0 },
    },
    {
      id: 'cluster-session',
      name: 'Session Management',
      packagePath: 'src/main/java/com/acme/session',
      anchor: { x: 0, y: 0, z: 0 },
    },
    {
      id: 'cluster-auth',
      name: 'Security & Identity',
      packagePath: 'src/main/java/com/acme/auth',
      anchor: { x: 80, y: -30, z: 0 },
    },
    {
      id: 'cluster-logging',
      name: 'Infrastructure & Logging',
      packagePath: 'src/main/java/com/acme/logging',
      anchor: { x: 0, y: 90, z: 40 },
    },
  ],
  nodes: [
    {
      id: 'sample-checkout',
      name: 'CheckoutService',
      path: 'src/main/java/com/acme/order/CheckoutService.java',
      clusterId: 'cluster-order',
      clusterName: 'Order Processing',
      complexity: 28,
      health: 72,
      loc: 310,
      x: -90,
      y: 20,
      z: 0,
    },
    {
      id: 'sample-session',
      name: 'SessionManager',
      path: 'src/main/java/com/acme/session/SessionManager.java',
      clusterId: 'cluster-session',
      clusterName: 'Session Management',
      complexity: 22,
      health: 81,
      loc: 240,
      x: 0,
      y: 0,
      z: 0,
    },
    {
      id: 'sample-auth',
      name: 'AuthTokenValidator',
      path: 'src/main/java/com/acme/auth/AuthTokenValidator.java',
      clusterId: 'cluster-auth',
      clusterName: 'Security & Identity',
      complexity: 15,
      health: 94,
      loc: 180,
      x: 90,
      y: -20,
      z: 0,
    },
    {
      id: 'sample-logger',
      name: 'AppLogger',
      path: 'src/main/java/com/acme/logging/AppLogger.java',
      clusterId: 'cluster-logging',
      clusterName: 'Infrastructure & Logging',
      complexity: 6,
      health: 98,
      loc: 85,
      x: 0,
      y: 85,
      z: 35,
    },
  ],
  edges: [
    {
      id: 'sample-edge-checkout-session',
      source: 'sample-checkout',
      target: 'sample-session',
      type: 'calls',
      weight: 8,
      callSiteLine: 37,
      callSiteCode: 'UserSession session = sessionManager.validateSession(sessionToken);',
      explanation: 'CheckoutService invokes validateSession(...) to authenticate customer prior to order placement.',
    },
    {
      id: 'sample-edge-session-auth',
      source: 'sample-session',
      target: 'sample-auth',
      type: 'calls',
      weight: 9,
      callSiteLine: 32,
      callSiteCode: 'TokenValidationResult result = tokenValidator.verifyToken(rawToken);',
      explanation: 'SessionManager delegates bearer token signature verification to AuthTokenValidator.',
    },
  ],
};

export const SAMPLE_EVIDENCE_MAP: Record<string, SourceEvidence> = {
  'sample-edge-checkout-session': {
    edgeId: 'sample-edge-checkout-session',
    callerId: 'sample-checkout',
    callerName: 'CheckoutService',
    callerPath: 'src/main/java/com/acme/order/CheckoutService.java',
    calleeId: 'sample-session',
    calleeName: 'SessionManager',
    calleePath: 'src/main/java/com/acme/session/SessionManager.java',
    lineNumber: 37,
    statement: 'UserSession session = sessionManager.validateSession(sessionToken);',
    relationship: 'calls method validateSession(String)',
    explanation: 'CheckoutService depends on SessionManager. If validateSession contract or exception behavior changes, checkout transactions fail.',
    surroundingCode: parseSurroundingCode(SAMPLE_JAVA_SOURCES.checkout, 37, 6, 10),
  },
  'sample-edge-session-auth': {
    edgeId: 'sample-edge-session-auth',
    callerId: 'sample-session',
    callerName: 'SessionManager',
    callerPath: 'src/main/java/com/acme/session/SessionManager.java',
    calleeId: 'sample-auth',
    calleeName: 'AuthTokenValidator',
    calleePath: 'src/main/java/com/acme/auth/AuthTokenValidator.java',
    lineNumber: 32,
    statement: 'TokenValidationResult result = tokenValidator.verifyToken(rawToken);',
    relationship: 'calls method verifyToken(String)',
    explanation: 'SessionManager depends directly on AuthTokenValidator. Modifying verifyToken response type or validation logic directly alters session state evaluation.',
    surroundingCode: parseSurroundingCode(SAMPLE_JAVA_SOURCES.session, 32, 6, 10),
  },
};
