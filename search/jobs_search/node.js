import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import axios from "axios";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

dotenv.config();

const config = {
  title: "Jobs Search",
  category: "search",
  type: "jobs_search",
  icon: {},
  desc: "Search for jobs with a given search term using Adzuna API",
  credit: 10,
  inputs: [
    {
      desc: "The flow of the workflow",
      name: "Flow",
      type: "Flow",
    },
    {
      desc: "Terms to search",
      name: "Terms",
      type: "Text",
    },
    {
      desc: "Minimum Salary you want",
      name: "Min Salary",
      type: "Number",
    },
  ],
  outputs: [
    {
      desc: "The list of retrieved jobs (JSON array)",
      name: "Job List",
      type: "JSON",
    },
    {
      desc: "The list of jobs in CSV format",
      name: "Job List CSV",
      type: "Text",
    },
    {
      desc: "The tool version of this node, to be used by LLMs",
      name: "Tool",
      type: "Tool",
    },
  ],
  fields: [
    {
      desc: "Terms to search",
      name: "Terms",
      type: "Text",
      value: "Enter text here...",
    },
    {
      desc: "Minimum Salary you want",
      name: "Min Salary",
      type: "Number",
      value: 0,
    },
    {
      desc: "The country where you want to work",
      name: "Country",
      type: "select",
      value: "United States",
      options: [
        "Great Britain",
        "United States",
        "Austria",
        "Australia",
        "Belgium",
        "Brazil",
        "Canada",
        "Switzerland",
        "Germany",
        "Spain",
        "France",
        "India",
        "Italy",
        "Mexico",
        "Netherlands",
        "New Zealand",
        "Poland",
        "Singapore",
        "South Africa",
      ],
    },
  ],
  difficulty: "easy",
  tags: ["jobs", "adzuna", "search"],
};

class jobs_search_node extends BaseNode {
  constructor() {
    super(config);
  }

  getValue(inputs, contents, name, defaultValue = null) {
    const input = inputs.find((i) => i.name === name);
    if (input?.value !== undefined) return input.value;
    const content = contents.find((c) => c.name === name);
    if (content?.value !== undefined) return content.value;
    return defaultValue;
  }

  json2csv(json) {
    if (!json || json.length === 0) return "";

    const rows = [];
    const headers = Object.keys(json[0]);
    rows.push(headers.join(","));
    for (const row of json) {
      rows.push(
        headers
          .map((header) => {
            const value = row[header];
            if (typeof value === "string") {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(",")
      );
    }
    return rows.join("\n");
  }

  formatSalary(min, max, currencyCode) {
    const options = {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 0,
    };
    const locale = "en";

    if (min && max) {
      return `${min.toLocaleString(locale, options)} - ${max.toLocaleString(
        locale,
        options
      )} per year`;
    }
    if (min) {
      return `From ${min.toLocaleString(locale, options)} per year`;
    }
    if (max) {
      return `Up to ${max.toLocaleString(locale, options)} per year`;
    }

    return "Not specified";
  }

  // --- API Execution Helper ---
  async executeJobSearch(query, minSalary, country, webconsole) {
    const countryDict = {
      "Great Britain": "gb",
      "United States": "us",
      Austria: "at",
      Australia: "au",
      Belgium: "be",
      Brazil: "br",
      Canada: "ca",
      Switzerland: "ch",
      Germany: "de",
      Spain: "es",
      France: "fr",
      India: "in",
      Italy: "it",
      Mexico: "mx",
      Netherlands: "nl",
      "New Zealand": "nz",
      Poland: "pl",
      Singapore: "sg",
      "South Africa": "za",
    };

    const currencyCodeDict = {
      "Great Britain": "GBP",
      "United States": "USD",
      Austria: "EUR",
      Australia: "AUD",
      Belgium: "EUR",
      Brazil: "BRL",
      Canada: "CAD",
      Switzerland: "CHF",
      Germany: "EUR",
      Spain: "EUR",
      France: "EUR",
      India: "INR",
      Italy: "EUR",
      Mexico: "MXN",
      Netherlands: "EUR",
      "New Zealand": "NZD",
      Poland: "PLN",
      Singapore: "SGD",
      "South Africa": "ZAR",
    };

    if (!query) {
      throw new Error("Search query (Terms) is required.");
    }

    const countryCode = countryDict[country] || "us";
    const currencyCode = currencyCodeDict[country] || "USD";

    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      throw new Error(
        "Adzuna API credentials not provided in environment variables."
      );
    }

    const searchParamsObj = {
      app_id: process.env.ADZUNA_APP_ID,
      app_key: process.env.ADZUNA_APP_KEY,
      results_per_page: 30,
      what: query,
      ...(minSalary > 0 && { salary_min: minSalary }),
    };
    const searchParams = new URLSearchParams(searchParamsObj).toString();
    const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${searchParams}`;

    const axiosConfig = {
      method: "get",
      maxBodyLength: Infinity,
      url: url,
      headers: {},
    };

    const response = await axios.request(axiosConfig);

    if (response.status !== 200) {
      throw new Error(`API request failed with status: ${response.status}`);
    }

    const data = response.data;
    const results = data.results || [];

    webconsole.success(
      `JOBS SEARCH NODE | Successfully retrieved ${results.length} jobs for query: ${query}.`
    );

    const jobList = results.map((job) => ({
      id: job.id,
      title: job.title,
      company: job.company.display_name,
      location: job.location.display_name,
      job_url: job.redirect_url,
      posted_on: new Date(job.created).toISOString().split("T")[0],
      contract_type: job.contract_time || job.contract_type || "Not specified",
      salary: this.formatSalary(job.salary_min, job.salary_max, currencyCode),
      description: job.description.substring(0, 200) + "...",
    }));

    const outputJSON = {
      query: query,
      country: country,
      count: jobList.length,
      jobList: jobList,
    };

    const outputCSV = this.json2csv(jobList);

    return {
      "Job List": outputJSON,
      "Job List CSV": outputCSV,
      count: jobList.length,
    };
  }

  async run(inputs, contents, webconsole, serverData) {
    webconsole.info("JOBS SEARCH NODE | Starting execution");

    const executionCredit = this.getCredit();
    const query = this.getValue(inputs, contents, "Terms", "");
    const minSalary = this.getValue(inputs, contents, "Min Salary", 0);
    const country = this.getValue(inputs, contents, "Country", "United States");

    // Initial check for API keys (cannot be executed as a tool or directly without keys)
    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
      this.setCredit(0);
      webconsole.error(
        "JOBS SEARCH NODE | Adzuna API credentials not provided in environment variables."
      );
    }

    const jobsSearchTool = tool(
      async ({ terms, minSalary, country }, toolConfig) => {
        webconsole.info("JOBS SEARCH TOOL | Invoking tool");

        if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
          webconsole.error("JOBS SEARCH TOOL | API credentials missing.");
          return [
            JSON.stringify({
              "Job List": null,
              "Job List CSV": null,
              error: "Adzuna API credentials are not configured.",
            }),
            this.getCredit(),
          ];
        }

        try {
          const result = await this.executeJobSearch(
            terms,
            minSalary || 0,
            country,
            webconsole
          );

          this.setCredit(this.getCredit() + executionCredit);

          const toolOutput = {
            summary: `Successfully retrieved ${result.count} job(s) matching query: "${terms}".`,
            jobs: result["Job List"].jobList.map((j) => ({
              title: j.title,
              company: j.company,
              salary: j.salary,
            })),
          };

          return [JSON.stringify(toolOutput), this.getCredit()];
        } catch (error) {
          this.setCredit(this.getCredit() - executionCredit);
          webconsole.error(`JOBS SEARCH TOOL | Error: ${error.message}`);
          return [
            JSON.stringify({
              "Job List": null,
              "Job List CSV": null,
              error: error.message,
            }),
            this.getCredit(),
          ];
        }
      },
      {
        name: "adzunaJobSearch",
        description:
          "Searches for job listings using the Adzuna API based on search terms, minimum salary, and country. Returns a list of jobs in JSON and CSV format.",
        schema: z.object({
          terms: z
            .string()
            .min(1)
            .describe(
              "The main keywords or job title to search for (e.g., 'data scientist', 'remote marketing')."
            ),
          minSalary: z
            .number()
            .int()
            .min(0)
            .default(0)
            .optional()
            .describe(
              "The minimum annual salary desired for the job listings."
            ),
          country: z
            .enum(Object.keys(countryDict))
            .default("United States")
            .optional()
            .describe("The country where the job should be located."),
        }),
        responseFormat: "content_and_artifact",
      }
    );

    // 1. Check for API keys (already set credit to 0 if missing)
    if (this.getCredit() === 0) {
      return {
        "Job List": null,
        "Job List CSV": null,
        Credits: 0,
        Tool: jobsSearchTool,
      };
    }

    // 2. Check for required input for direct execution
    if (!query) {
      this.setCredit(0);
      webconsole.warn(
        "JOBS SEARCH NODE | No search query provided in node inputs. Returning tool only."
      );
      return {
        "Job List": null,
        "Job List CSV": null,
        Credits: 0,
        Tool: jobsSearchTool,
      };
    }

    // 3. Direct execution
    try {
      const result = await this.executeJobSearch(
        query,
        minSalary,
        country,
        webconsole
      );

      // Credit is already set to the base value (10) for successful direct execution.
      this.setStats("Number of Jobs", result.count);

      return {
        "Job List": result["Job List"],
        "Job List CSV": result["Job List CSV"],
        Credits: this.getCredit(),
        Tool: jobsSearchTool,
      };
    } catch (error) {
      const errorMessage = error.response
        ? JSON.stringify(error.response.data)
        : error.message;
      webconsole.error(
        `JOBS SEARCH NODE | Error occurred during direct search: ${errorMessage}`
      );
      this.setCredit(0);
      return {
        "Job List": null,
        "Job List CSV": null,
        Credits: 0,
        Tool: jobsSearchTool,
      };
    }
  }
}

export default jobs_search_node;
