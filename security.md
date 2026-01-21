## Security Policy (OWASP Top 10:2025)

This project must comply with OWASP Top 10:2025.
You must proactively apply these rules when generating or reviewing code.

### Global Security Rules
- Never trust client input
- Validate and sanitize all external inputs
- Fail securely (no stack traces or sensitive info)
- Use secure defaults
- Prefer explicit denial over implicit access

---

### A01: Broken Access Control
- Always check authorization at service level
- Do NOT rely on frontend or route-only checks
- Use explicit role/permission checks
- Deny by default

---

### A02: Security Misconfiguration
- Do not expose internal errors, stack traces, or configs
- Environment variables must be validated at startup
- Disable unused features and endpoints
- Never assume default framework security is sufficient

---

### A03: Software Supply Chain Failures
- Do not introduce new dependencies without explicit approval
- Prefer well-maintained, popular libraries
- Avoid deprecated or unmaintained packages
- Warn if a dependency may pose security risk

---

### A04: Cryptographic Failures
- Never implement custom cryptography
- Use proven libraries only
- Do not store plaintext secrets or passwords
- Always hash passwords with a secure algorithm (e.g. bcrypt, argon2)

---

### A05: Injection
- Never concatenate user input into SQL or queries
- Always use parameterized queries or ORM safe methods
- Sanitize input used in dynamic queries
- Treat file paths, shell commands, and templates as injection vectors

---

### A06: Insecure Design
- Prefer simple, explicit designs over complex ones
- Avoid security-by-obscurity
- Apply defense-in-depth
- Flag designs that rely on a single security control

---

### A07: Authentication Failures
- Never store or log credentials
- Enforce strong password policies
- Use secure session/token handling
- Always validate authentication state server-side

---

### A08: Software or Data Integrity Failures
- Validate integrity of external data and files
- Avoid unsafe deserialization
- Do not execute untrusted code or scripts
- Verify data consistency across system boundaries

---

### A09: Security Logging and Alerting Failures
- Log security-relevant events (auth failure, access denial)
- Do not log sensitive data
- Ensure logs are meaningful and actionable
- Errors must be traceable without exposing secrets

---

### A10: Mishandling of Exceptional Conditions
- Catch and handle all expected errors
- Never crash the application on user input
- Return controlled, sanitized error responses
- Ensure errors do not leak internal state

---

### Enforcement Rules
- Warn if a request violates any OWASP Top 10 rule
- Refuse to generate insecure code patterns
- Suggest a secure alternative when rejecting a request

