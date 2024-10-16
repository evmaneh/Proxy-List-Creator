const path = require("path");
const fs = require("fs");
const axios = require("axios");
const fastify = require("fastify")({
  logger: true,
});

// Serve static files
fastify.register(require("@fastify/static"), {
  root: path.join(__dirname, "public"),
});

// Handle form body
fastify.register(require("@fastify/formbody"));

// Set up view engine
fastify.register(require("@fastify/view"), {
  engine: {
    handlebars: require("handlebars"),
  },
});

// Load SEO configuration
const seo = require("./src/seo.json");
if (seo.url === "glitch-default") {
  seo.url = `https://${process.env.PROJECT_DOMAIN}.glitch.me`;
}

// Load previous entries
let previousEntries = [];
if (fs.existsSync("data.json")) {
  previousEntries = JSON.parse(fs.readFileSync("data.json", "utf-8"));
}

// Route to render the homepage
fastify.get("/", function (request, reply) {
  // Separate entries into containers based on the selected container
  const container1 = previousEntries.filter(entry => entry.container === "1");
  const container2 = previousEntries.filter(entry => entry.container === "2");
  const container3 = previousEntries.filter(entry => entry.container === "3");

  const params = { seo: seo, container1, container2, container3 };
  return reply.view("/src/pages/index.hbs", params);
});

// Route to analyze URLs
fastify.post("/analyze", async (request, reply) => {
  const { title, urls, container } = request.body;
  let entries = [];

  // Split the URLs into an array, trimming whitespace
  const urlArray = urls.split('\n').map(url => url.trim()).filter(url => url);

  for (const url of urlArray) {
    let status = "Inactive";
    let error = null;

    // Automatically add "https://" if not present
    const formattedUrl = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;

    try {
      // Check URL activity
      const response = await axios.get(formattedUrl);
      if (response.status >= 200 && response.status < 400) {
        status = "Active";
      }
    } catch (err) {
    }

    // Automatically generate title if none is provided
    const entryTitle = title.trim()
      ? title
      : formattedUrl.replace(/(^\w+:|^)\/\//, '');  // Remove protocol (https:// or http://)

    // Save each entry along with the chosen container
    const entry = { title: entryTitle, url: formattedUrl, status, error, container };
    entries.push(entry);
  }

  // Save all entries
  previousEntries = previousEntries.concat(entries);
  fs.writeFileSync("data.json", JSON.stringify(previousEntries, null, 2));

  // Redirect back to homepage
  reply.redirect("/");
});

// Route to delete an entry
fastify.post("/delete", function (request, reply) {
  const { title } = request.body;

  // Filter out the entry with the matching title
  previousEntries = previousEntries.filter(entry => entry.title !== title);

  // Save updated entries to the JSON file
  fs.writeFileSync("data.json", JSON.stringify(previousEntries, null, 2));

  // Redirect back to homepage
  reply.redirect("/");
});


// Start the server
fastify.listen(
  { port: process.env.PORT || 3000, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`Your app is listening on ${address}`);
  }
);
