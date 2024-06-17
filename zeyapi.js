#!/usr/bin/env node

import express from 'express';
import bodyParser from 'body-parser';
import axios from 'axios';
import { Command } from 'commander';
import open from 'open';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import Table from 'cli-table3';
import chalk from 'chalk';

const app = express();
const program = new Command();
const CONFIG_PATH = path.resolve('zeyos-api/config.json');
const ROUTES_DIR = path.resolve('zeyos-api/routes');
const API_URL = 'https://cloud.zeyos.com/__ext/openapi/api.json';

program
    .command('link')
    .description('Link a new ZeyOS application')
    .action(async () => {
        const { instance, clientId, secret } = await inquirer.prompt([
            { type: 'input', name: 'instance', message: 'Enter the ZeyOS instance ID:' },
            { type: 'input', name: 'clientId', message: 'Enter the Client ID:' },
            { type: 'password', name: 'secret', message: 'Enter the Client Secret:' }
        ]);

        const authCode = 'AUTHCODE'; // Replace with the actual authorization code logic

        app.use(bodyParser.urlencoded({ extended: true }));

        app.get('/', async (req, res) => {
            res.send('OAuth2 callback received. You can close this window.');
            res.end();

            const code = req.query.code;
            try {
                const tokenResponse = await axios.post(`https://cloud.zeyos.com/${instance}/oauth2/v1/token`, null, {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`
                    },
                    params: {
                        grant_type: 'authorization_code',
                        authorization_code: code
                    }
                });

                const tokenData = tokenResponse.data;

                const config = {
                    instance,
                    clientId,
                    secret,
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token
                };

                await fs.ensureFile(CONFIG_PATH);
                await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });

                console.log('Configuration saved to zeyos-api/config.json');

                const { populateRoutes } = await inquirer.prompt([
                    { type: 'confirm', name: 'populateRoutes', message: 'Do you want to populate the routes directory with default routes?', default: true }
                ]);

                if (populateRoutes) {
                    await generateDefaultRoutes();
                }

                process.exit(0);
            } catch (error) {
                console.error('Error:', JSON.stringify(error.response.data, null, 2));
                process.exit(1);
            }
        });

        const server = app.listen(8080, async () => {
            console.log('Server is running on http://localhost:8080');
            console.log('Opening browser for OAuth2 authorization...');
            open(`https://cloud.zeyos.com/${instance}/oauth2/v1/authorize?client_id=${clientId}&redirect_uri=http://localhost:8080&response_type=code`);
        });
    });

program
    .command('run <route>')
    .description('Run a specific API route')
    .option('-p, --param <params>', 'Parameters in the format key=value,key2=value2')
    .option('-v, --verbose', 'Enable verbose mode')
    .action(async (route, options) => {
        const config = await fs.readJson(CONFIG_PATH);

        // Refresh tokens before making the API call
        try {
            const tokenResponse = await axios.post(`https://cloud.zeyos.com/${config.instance}/oauth2/v1/token`, null, {
                headers: {
                    'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.secret}`).toString('base64')}`
                },
                params: {
                    grant_type: 'refresh_token',
                    refresh_token: config.refresh_token
                }
            });

            const tokenData = tokenResponse.data;

            config.access_token = tokenData.access_token;
            config.refresh_token = tokenData.refresh_token;

            await fs.writeJson(CONFIG_PATH, config, { spaces: 2 });
        } catch (error) {
            console.error('Error refreshing token:', JSON.stringify(error.response.data, null, 2));
            process.exit(1);
        }

        const routePath = path.resolve(ROUTES_DIR, `${route}.json`);

        if (!await fs.pathExists(routePath)) {
            console.error(`Route ${route} does not exist.`);
            process.exit(1);
        }

        const routeConfig = await fs.readJson(routePath);
        const { method, route: apiRouteOriginal, data } = routeConfig;

        let apiRoute = apiRouteOriginal;
        const requestData = data ? { ...data } : null;

        // Parse parameters
        const params = {};
        if (options.param) {
            options.param.split(',').forEach(param => {
                const [key, value] = param.split('=');
                params[key] = value;
            });
        }

        // Replace placeholders in the data
        if (requestData) {
            for (const key in params) {
                replacePlaceholder(requestData, key, params[key]);
            }
        }

        // Ask for parameters if they are not included as a CLI argument
        const placeholders = apiRoute.match(/{\w+}/g);
        if (placeholders) {
            for (const placeholder of placeholders) {
                const key = placeholder.replace(/[{}]/g, '');
                if (!params[key]) {
                    const answer = await inquirer.prompt([
                        { type: 'input', name: key, message: `Enter value for ${key}:` }
                    ]);
                    apiRoute = apiRoute.replace(placeholder, answer[key]);
                } else {
                    apiRoute = apiRoute.replace(placeholder, params[key]);
                }
            }
        }

        const url = `https://cloud.zeyos.com/${config.instance}/api/v1${apiRoute}`;
        if (options.verbose) {
            console.log('Request Details:');
            console.log('Method:', method);
            console.log('URL:', url);
            console.log('Headers:', { 'Authorization': `Bearer ${config.access_token}` });
            if (requestData) {
                console.log('Data:', requestData);
            }
        }

        try {
            const response = await axios({
                method,
                url,
                headers: {
                    'Authorization': `Bearer ${config.access_token}`
                },
                data: requestData
            });

            const statusCode = response.status;
            const statusMessage = `HTTP Status Code: ${statusCode}`;
            if (statusCode >= 200 && statusCode < 300) {
                console.log(chalk.green(statusMessage));
            } else if (statusCode >= 400 && statusCode < 500) {
                console.log(chalk.yellow(statusMessage));
            } else if (statusCode >= 500) {
                console.log(chalk.red(statusMessage));
            }

            console.log('Response:', JSON.stringify(response.data, null, 2));
        } catch (error) {
            if (error.response) {
                const statusCode = error.response.status;
                const statusMessage = `HTTP Status Code: ${statusCode}`;
                if (statusCode >= 200 && statusCode < 300) {
                    console.log(chalk.green(statusMessage));
                } else if (statusCode >= 400 && statusCode < 500) {
                    console.log(chalk.yellow(statusMessage));
                } else if (statusCode >= 500) {
                    console.log(chalk.red(statusMessage));
                }
                console.error('Error:', JSON.stringify(error.response.data, null, 2));
            } else {
                console.error('Error:', error.message);
            }
        }
    });

program
    .command('generate')
    .description('Generate default routes')
    .action(async () => {
        await generateDefaultRoutes();
    });

program
    .command('routes [filter]')
    .description('List all routes, optionally filtered by a search term')
    .action(async (filter) => {
        const files = await fs.readdir(ROUTES_DIR);
        const table = new Table({
            head: ['Name', 'Route URL', 'Method', 'Description']
        });

        for (const file of files) {
            if (file.endsWith('.json') && (!filter || file.includes(filter))) {
                const routeConfig = await fs.readJson(path.join(ROUTES_DIR, file));
                table.push([file, routeConfig.route, routeConfig.method, routeConfig.description]);
            }
        }

        console.log(table.toString());
    });

program.parse(process.argv);

async function fetchSwaggerJSON() {
    try {
        const response = await axios.get(API_URL);
        return response.data;
    } catch (error) {
        console.error('Error fetching Swagger JSON:', error);
        process.exit(1);
    }
}

function extractRoutes(swaggerJSON) {
    const routes = [];
    for (const [route, methods] of Object.entries(swaggerJSON.paths)) {
        for (const [method, details] of Object.entries(methods)) {
            const routeInfo = {
                route,
                method: method.toUpperCase(),
                description: details.summary || details.description || ''
            };

            if (details.parameters) {
                const fields = {};
                details.parameters.forEach(param => {
                    const placeholder = `{${param.name}}`;
                    if (param.in === 'path') {
                        route = route.replace(`{${param.name}}`, `{${param.name}}`);
                    } else {
                        fields[param.name] = placeholder;
                    }
                });
            }

            routes.push(routeInfo);
        }
    }
    return routes;
}

function generateFileName(route, method) {
    return `${route.replace(/^\//, '').replace(/[{}]/g, '').replace(/[\/]/g, '-').toLowerCase()}-${method.toLowerCase()}.json`;
}

async function generateRouteFiles(routes) {
    await fs.ensureDir(ROUTES_DIR);
    for (const route of routes) {
        const fileName = generateFileName(route.route, route.method);
        const filePath = path.join(ROUTES_DIR, fileName);
        const { data, ...routeWithoutData } = route;
        const routeData = data ? route : routeWithoutData;
        await fs.writeJson(filePath, routeData, { spaces: 2 });
    }
    console.log(`Generated ${routes.length} route files in ${ROUTES_DIR}`);
}

async function generateDefaultRoutes() {
    const swaggerJSON = await fetchSwaggerJSON();
    const routes = extractRoutes(swaggerJSON);
    await generateRouteFiles(routes);
}

function replacePlaceholder(obj, placeholder, value) {
    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            replacePlaceholder(obj[key], placeholder, value);
        } else if (obj[key] === `{${placeholder}}`) {
            obj[key] = value;
        }
    }
}