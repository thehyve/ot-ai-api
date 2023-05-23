const express = require("express");
const { handleLiterartureRequest } = require("../controllers/literature");

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("SearchID:", req.body.payload.id);
  const id = req.body.payload.id;
  const json = await handleLiterartureRequest({ id });
  res.send(json);
});

module.exports = router;
