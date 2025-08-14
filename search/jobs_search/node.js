import BaseNode from "../../core/BaseNode/node.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const config = {
    title: "Jobs Search",
    category: "search",
    type: "jobs_search",
    icon: {},
    desc: "Search for jobs with a given search term using adzuna",
    credit: 100,
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
            desc: "The list of retrieved jobs",
            name: "Job List",
            type: "JSON",
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
}

class web_search_node extends BaseNode {

    constructor() {
        super(config);
    }

    formatSalary(min, max, currencyCode) {
        const options = {
            style: "currency",
            currency: currencyCode,
            maximumFractionDigits: 0,
        };
        if (min && max) {
            return `${min.toLocaleString('en', options)} - ${max.toLocaleString('en', options)} per year`;
        }
        if (min) {
            return `From ${min.toLocaleString('en', options)} per year`;
        }
        if (max) {
            return `Up to ${max.toLocaleString('en', options)} per year`;
        }

        return 'Not specified';
    }

    async run(inputs, contents, webconsole, serverData) {

        try {
            const countryDict = {
                "Great Britain": "gb",
                "United States": "us",
                "Austria": "at",
                "Australia": "au",
                "Belgium": "be",
                "Brazil": "br",
                "Canada": "ca",
                "Switzerland": "ch",
                "Germany": "de",
                "Spain": "es",
                "France": "fr",
                "India": "in",
                "Italy": "it",
                "Mexico": "mx",
                "Netherlands": "nl",
                "New Zealand": "nz",
                "Poland": "pl",
                "Singapore": "sg",
                "South Africa": "za",
            };

            const currencyCodeDict = {
                "Great Britain": "GBP",
                "United States": "USD",
                "Austria": "EUR",
                "Australia": "AUD",
                "Belgium": "EUR",
                "Brazil": "BRL",
                "Canada": "CAD",
                "Switzerland": "CHF",
                "Germany": "EUR",
                "Spain": "EUR",
                "France": "EUR",
                "India": "INR",
                "Italy": "EUR",
                "Mexico": "MXN",
                "Netherlands": "EUR",
                "New Zealand": "NZD",
                "Poland": "PLN",
                "Singapore": "SGD",
                "South Africa": "ZAR",
            };

            webconsole.info("JOBS SEARCH NODE | Searching your query");

            const queryFilter = inputs.find((e) => e.name === "Terms");
            const query = queryFilter?.value || contents.find((e) => e.name === "Terms")?.value || "";

            if (!query) {
                webconsole.error("JOBS SEARCH NODE | No query found");
                return null;
            }

            const salaryFilter = inputs.find((e) => e.name === "Min Salary");
            const minSalary = salaryFilter?.value || contents.find((e) => e.name === "Min Salary")?.value || 0;

            const countryFilter = contents.find((e) => e.name === "Country");
            const country = countryFilter?.value || "United States";
            const countryCode = Object.keys(countryDict).includes(country) ? countryDict[country] : "us";
            const currencyCode = Object.keys(currencyCodeDict).includes(country) ? currencyCodeDict[country] : "USD";

            if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY) {
                webconsole.error("JOBS SEARCH NODE | Adzuna API credentials not provided");
                return null;
            }

            const searchParamsObj = {
                app_id: process.env.ADZUNA_APP_ID,
                app_key: process.env.ADZUNA_APP_KEY,
                results_per_page: 30,
                what: query,
                ...(minSalary && { salary_min: minSalary }),
            };
            const searchParams = new URLSearchParams(searchParamsObj).toString();
            const url = `https://api.adzuna.com/v1/api/jobs/${countryCode}/search/1?${searchParams}`;

            const axiosConfig = {
                method: "get",
                maxBodyLength: Infinity,
                url: url,
                headers: {}
            };

            const response = await axios.request(axiosConfig);
            if (response.status === 200) {
                webconsole.success("JOBS SEARCH NODE | Successfully searched and extracted data");
                const data = response.data;

                const jobList = data.results.map(job => ({
                    id: job.id,
                    title: job.title,
                    company: job.company.display_name,
                    location: job.location.display_name,
                    job_url: job.redirect_url,
                    posted_on: new Date(job.created).toString(),
                    contract_type: job.contract_time || job.contract_type || "Not specified",
                    salary: this.formatSalary(job.salary_min, job.salary_max, currencyCode),
                    description: job.description,
                }));

                const outputJSON = {
                    "type": "Jobs",
                    "jobList": jobList
                };

                return {
                    "Job List": outputJSON
                };
            }
            else {
                webconsole.error("JOBS SEARCH NODE | Some error occured");
                return null;
            }
        } catch (error) {
            webconsole.error("JOBS SEARCH NODE | Error occurred while searching jobs");
            return null;
        }
        
        
    }
}

export default web_search_node;