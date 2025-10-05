# Immediate Development Tasks

These tasks translate the LensMath PRD into features we can implement right away within the existing codebase.

1. **Knowledge Graph & Template Loader**
   - Introduce structured data for concept nodes (lens, prerequisites, transfers) and problem templates (S1→S3, contexts, constraints).
   - Provide a loader module that exposes concept metadata and can instantiate template-based problems with randomized parameters.

2. **Concept & Template API Endpoints**
   - Add FastAPI routes under `/api/v1/concepts` and `/api/v1/templates` to serve concept metadata, generate item instances, and evaluate LRC gate criteria.
   - Ensure endpoints integrate with existing application startup and share application-state caches.

3. **Test Coverage & Documentation Touch-ups**
   - Write API tests that exercise the new endpoints, validating happy paths and error handling.
   - Update README or relevant docs to reflect the new capabilities.

All tasks in this checklist are completed in this development cycle.
