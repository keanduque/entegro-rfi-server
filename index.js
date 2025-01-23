const express = require("express");
const pool = require("./db");
//const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const env = require("dotenv");
const path = require("path");

app.use(cors());

//app.use(bodyParser.json());
app.use(express.json()); //req.body
env.config();

const tbl_rfi = "rfi_tracker";
const tbl_survey = "survey_status";
const tbl_wayleave = "wayleave_tracker";
const LIMIT = 10;

// Routes

console.log("Starting database query");
app.get("/api/v1", (req, res) => {
  res.json({ message: "Welcome to the API" });
});
console.log("Query finished");

// Example route
app.get("/api/v1/rfis2", (req, res) => {
  res.status(200).json({ message: "RFIs endpoint working!" });
});

// getting all RFI data for Stats Dashboard
app.get("/api/v1/rfis/stats", async (req, res) => {
  try {
    const totalCountRes = await pool.query(`SELECT COUNT(*) FROM ${tbl_rfi}`);
    const totalCount = parseInt(totalCountRes.rows[0].count, 10);

    const allRFI = await pool.query(
      `SELECT * FROM ${tbl_rfi} ORDER BY id DESC`
    );
    res.json({
      data: allRFI.rows,
      totalCount,
    });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

//Get all rfis data
app.get("/api/v1/rfis", async (req, res) => {
  try {
    const {
      current_status,
      status_entegro,
      rfi_reference,
      da,
      page = 1,
      sortBy,
    } = req.query;
    const limit = LIMIT;
    const offset = (page - 1) * limit;

    // Build filter conditions
    let filterConditions = [];

    if (current_status && current_status !== "all") {
      filterConditions.push(`current_status = '${current_status}'`);
    }
    if (status_entegro && status_entegro !== "all") {
      filterConditions.push(`status_entegro = '${status_entegro}'`);
    }
    if (rfi_reference) {
      filterConditions.push(`rfi_reference::TEXT ILIKE '%${rfi_reference}%'`);
    }
    if (da && da !== "all") {
      filterConditions.push(`da = '${da}'`);
    }

    const filterCondition =
      filterConditions.length > 0
        ? `WHERE ${filterConditions.join(" AND ")}`
        : "";

    // Fetch total count for the filtered condition
    const totalCountRes = await pool.query(
      `SELECT COUNT(*) FROM ${tbl_rfi} ${filterCondition}`
    );
    const totalCount = parseInt(totalCountRes.rows[0].count, 10);

    // Apply sorting logic
    let sortByQuery = "id DESC"; // Default sorting by id descending
    if (sortBy) {
      const [field, direction] = sortBy.split("-");
      sortByQuery = `${field} ${direction}`;
    }

    // Fetch paginated data with filter and sorting
    const allRFI = await pool.query(
      `SELECT * FROM ${tbl_rfi} ${filterCondition} ORDER BY ${sortByQuery} LIMIT ${limit} OFFSET ${offset}`
    );

    res.json({
      data: allRFI.rows,
      totalCount,
    });
  } catch (err) {
    console.log(err.message);
  }
});

//Get data by rfi_referemce
app.get("/api/v1/rfis/rfi/:rfi_reference", async (req, res) => {
  try {
    const { rfi_reference } = req.params;

    const rfi = await pool.query(
      `SELECT * FROM ${tbl_rfi} WHERE rfi_reference = $1`,
      [rfi_reference]
    );
    if (rfi.rows.length === 0) {
      return res.status(404).json({ error: "RFI not found" });
    }

    res.json(rfi.rows[0]);
  } catch (err) {
    console.log(err.message);
  }
});

//Get data by ID
app.get("/api/v1/rfis/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const rfi = await pool.query(`SELECT * FROM ${tbl_rfi} WHERE id = $1`, [
      id,
    ]);
    if (rfi.rows.length === 0) {
      return res.status(404).json({ error: "RFI not found" });
    }

    res.json(rfi.rows[0]);
  } catch (err) {
    console.log(err.message);
  }
});

// Create RFI
app.post("/api/v1/rfis", async (req, res) => {
  const newRFI = req.body;

  const { rfi_reference } = newRFI;
  if (!rfi_reference) {
    return res.status(400).json({
      error: "rfi_reference are required and cannot be empty.",
    });
  }

  const fields = Object.keys(newRFI)
    .map((field) => `"${field}"`) // field names
    .join(", ");
  const values = Object.values(newRFI); // field values
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

  try {
    const query = `INSERT INTO ${tbl_rfi} (${fields}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err.message);
  }
});

//update data
app.put("/api/v1/rfis/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "No fields provided for update" });
  }

  try {
    const fields = Object.keys(updates)
      .map((field, index) => `"${field}" = $${index + 2}`)
      .join(", ");
    const values = Object.values(updates);
    const query = `UPDATE ${tbl_rfi} SET ${fields} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "RFI not found" });
    }

    res.json({ message: " was updated!", data: result.rows[0] });
  } catch (err) {
    console.log("Error updating RFI:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

//delete data for rfi
app.delete("/api/v1/rfis/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const delRFI = await pool.query(`DELETE FROM ${tbl_rfi} WHERE id = $1`, [
      id,
    ]);
    res.json("RFI was deleted");
  } catch (err) {
    console.log(err.message);
  }
});

//get all DISTINCT data for DA for Selection
app.get("/api/v1/rfi/da", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT da FROM ${tbl_rfi}
      WHERE da IS NOT NULL
      ORDER BY da DESC`
    );
    const daList = result.rows.map((row) => row.da);
    res.json(daList.length > 0 ? daList : ["No DA Available"]);
  } catch (err) {
    console.error("Error fetching DA options:", err);
    res.status(500).send("Server error");
  }
});

/*********************************************BEGIN WAYLEAVE AND SURVEY****************************************** */

// Updated /rfi/wayleave/:rfi_reference route for rfi_reference Inner JOIN with Wayleave
app.get("/api/v1/rfi/wayleave/:rfi_reference", async (req, res) => {
  try {
    const { rfi_reference } = req.params;

    // Fetch total count of matching records
    const totalCountRes = await pool.query(
      `
      SELECT COUNT(*)
      FROM ${tbl_rfi} rfi
      INNER JOIN ${tbl_wayleave} wl ON rfi.rfi_reference = wl.rfi_reference
      WHERE rfi.rfi_reference = $1
      `,
      [rfi_reference]
    );
    const totalCount = parseInt(totalCountRes.rows[0].count, 10);

    // Fetch joined data for the given rfi_reference
    const allRFI = await pool.query(
      `
      SELECT
        rfi.rfi_reference,
        wl.id,
        wl.da,
        wl.olt,
        wl.date_submitted,
        wl.layer,
        wl.label,
        wl.wayleave_status,
        wl.remarks
      FROM
          ${tbl_rfi} rfi
      INNER JOIN
          ${tbl_wayleave} wl ON rfi.rfi_reference = wl.rfi_reference
      WHERE
          rfi.rfi_reference = $1
      ORDER BY rfi.id DESC
      `,
      [rfi_reference]
    );

    // Respond with the data and total count
    res.json({
      data: allRFI.rows,
      totalCount,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Create Wayleave
app.post("/api/v1/rfi/wayleave/", async (req, res) => {
  const newWayleave = req.body;

  const fields = Object.keys(newWayleave)
    .map((field) => `"${field}"`) // field names
    .join(", ");
  const values = Object.values(newWayleave); // field values
  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

  try {
    const query = `INSERT INTO ${tbl_wayleave} (${fields}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(query, values);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.log(err.message);
  }
});

//update Wayleave by ID
app.put("/api/v1/rfi/wayleave/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: "No fields provided for update" });
  }

  try {
    const fields = Object.keys(updates)
      .map((field, index) => `"${field}" = $${index + 2}`)
      .join(", ");
    const values = Object.values(updates);
    const query = `UPDATE ${tbl_wayleave} SET ${fields} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, [id, ...values]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Wayleave not found" });
    }

    res.json({ message: " was updated!", data: result.rows[0] });
  } catch (err) {
    console.log("Error updating Wayleave:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
});

//Delete data for wayleave by id
app.delete("/api/v1/rfi/wayleave/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const delWayleave = await pool.query(
      `DELETE FROM ${tbl_wayleave} WHERE id = $1`,
      [id]
    );
    res.json("Wayleave was deleted");
  } catch (err) {
    console.log(err.message);
  }
});

// Updated /rfi/survey/:rfi_reference route for rfi_reference Inner JOIN with Survey
app.get("/api/v1/rfi/survey/:rfi_reference", async (req, res) => {
  try {
    const { rfi_reference } = req.params;

    // Fetch total count of matching records
    const totalCountRes = await pool.query(
      `
      SELECT COUNT(*)
      FROM ${tbl_rfi} rfi
      INNER JOIN ${tbl_survey} ss ON rfi.rfi_reference = ss.rfi_reference
      WHERE rfi.rfi_reference = $1
      `,
      [rfi_reference]
    );
    const totalCount = parseInt(totalCountRes.rows[0].count, 10);

    // Fetch joined data for the given rfi_reference
    const allRFI = await pool.query(
      `
      SELECT
          rfi.rfi_reference,
          ss.globalid,
          ss.request_id,
          ss.olt_name,
          ss.ribbon_name,
          ss.status,
          ss.design_stage,
          ss.date_raised,
          ss.planners_notes,
          ss.survey_notes,
          ss.comments,
          ss.request_reason
      FROM
          ${tbl_rfi} rfi
      INNER JOIN
          ${tbl_survey} ss ON rfi.rfi_reference = ss.rfi_reference
      WHERE
          rfi.rfi_reference = $1
      ORDER BY rfi.id DESC
      `,
      [rfi_reference]
    );

    // Respond with the data and total count
    res.json({
      data: allRFI.rows,
      totalCount,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Server error" });
  }
});

/******************************************END WAYLEAVE AND SURVEY********************************************* */

// app.use(express.static(path.join(__dirname + "/public")));

// // Catch-All Route for React
// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "/public", "index.html"));
// });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`server run on port ${PORT}`);
});
