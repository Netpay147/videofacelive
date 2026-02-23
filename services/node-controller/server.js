const express = require("express")
const axios = require("axios")
const app = express()

app.get("/run-ai", async (req, res) => {
  const response = await axios.get("http://localhost:8000/health")
  res.json(response.data)
})

app.listen(3001)