import { Router } from "express";
import { listAudit, toAuditCsv } from "../audit.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    const service = typeof req.query.service === "string" ? req.query.service : undefined;
    const rows = await listAudit({ limit, service });
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

router.get("/export", async (req, res, next) => {
  try {
    const service = typeof req.query.service === "string" ? req.query.service : undefined;
    const rows = await listAudit({ limit: 5000, service });
    const csv = toAuditCsv(rows);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ghostkey-audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

export default router;
