import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth.js";
import usersRouter from "./users.js";
import areasRouter from "./areas.js";
import employeesRouter from "./employees.js";
import eventsRouter from "./events.js";
import criteriaRouter from "./criteria.js";
import evaluationsRouter from "./evaluations.js";
import calibrationsRouter from "./calibrations.js";
import absencesRouter from "./absences.js";
import rulesRouter from "./rules.js";
import dashboardRouter from "./dashboard.js";
import resultsRouter from "./results.js";
import rankingRouter from "./ranking.js";
import auditRouter from "./audit.js";
import integrationRouter from "./integration.js";
import exportsRouter from "./exports.js";
import myPerformanceRouter from "./my-performance.js";
import feedbackRouter from "./feedback.js";
import eligibilityRouter from "./eligibility.js";
import storageRouter from "./storage.js";
import cyclesRouter from "./cycles.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// storageRouter is mounted early, BEFORE any router with a blanket
// requireRole (audit, integration use requireRole("admin","rh")). Those guards
// run for every fall-through request and would otherwise 403 audio
// uploads/playback used by avaliadores. Storage has its own guards: requireAuth
// on the upload-URL endpoint, public GET for <audio> playback.
router.use(storageRouter);
// cyclesRouter mounted early for the same reason as storageRouter: it must come
// BEFORE auditRouter/integrationRouter (blanket requireRole("admin","rh")),
// otherwise those guards 403 the current-cycle read for non-admin roles
// (avaliador/colaborador) that need it on my-performance, etc.
router.use(cyclesRouter);
router.use(usersRouter);
router.use(areasRouter);
router.use(employeesRouter);
router.use(eventsRouter);
router.use(criteriaRouter);
router.use(evaluationsRouter);
router.use(calibrationsRouter);
router.use(absencesRouter);
router.use(rulesRouter);
router.use(dashboardRouter);
router.use(resultsRouter);
router.use(rankingRouter);
router.use(auditRouter);
router.use(integrationRouter);
router.use(exportsRouter);
router.use(myPerformanceRouter);
router.use(feedbackRouter);
router.use(eligibilityRouter);

export default router;
