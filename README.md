ZeyOS REST API Browser
======================

A CLI tool to interact with the ZeyOS API. This tool allows you to link a ZeyOS application, generate default routes, and call API routes with ease.

## Introduction

### What is OAuth 2.0?

OAuth 2.0 is an authorization framework that allows applications to obtain limited access to user accounts on an HTTP service. It works by delegating user authentication to the service that hosts the user account, and authorizing third-party applications to access the user account.

Here is a schematic diagram that illustrates the basic OAuth 2.0 flow:

```
+--------+                               +----------------+
|        |--(A)- Authorization Request ->|                |
|        |                               |  Resource      |
|        |<-(B)-- Authorization Grant ---|  Owner         |
|        |                               +----------------+
|        |                               +----------------+
|        |--(C)-- Authorization Grant -->|                |
| Client |                               | Authorization  |
|        |<-(D)----- Access Token -------|  Server        |
|        |                               +----------------+
|        |                               +----------------+
|        |--(E)----- Access Token ------>|                |
|        |                               |    Resource    |
|        |<-(F)--- Protected Resource ---|     Server     |
+--------+                               +----------------+
```

- **Step A**: The client requests authorization from the resource owner.
- **Step B**: The resource owner grants authorization.
- **Step C**: The client receives the authorization grant and requests an access token from the authorization server.
- **Step D**: The authorization server issues an access token.
- **Step E**: The client uses the access token to request the protected resource from the resource server.
- **Step F**: The resource server returns the requested resource.

### About ZeyOS

ZeyOS is a comprehensive business operating system that integrates all the functions of an enterprise into a single, cohesive system. This includes CRM, ERP, groupware, and many other functionalities. ZeyOS provides an extensive API that allows developers to interact with the platform programmatically.

For more information, visit the [ZeyOS API documentation](https://developers.zeyos.com/api/).

## Installation

1. Clone the repository or download the script.
2. Install the dependencies:

    ```bash
    npm install
    ```

3. Link the CLI tool globally:

    ```bash
    npm link
    ```

## Usage

The tool requires linking a ZeyOS application to obtain the necessary OAuth 2.0 tokens and generate default routes.

### Link a New Application

```bash
zeysdk link
```

Follow the prompts to enter the instance ID, client ID, and client secret. The tool will guide you through the OAuth2 authorization process and save the tokens in `zeyos-api/config.json`. You will also be prompted to populate the routes directory with default routes.

### Call an API Route

```bash
zeysdk run <route-name> --param "<placeholder>=<value>,..." [--verbose|-v]
```

#### Example

```bash
zeysdk run accounts-list -p "ID=4844"
```

This will replace the `{limit}` placeholder with `5` and call the `/api/v1/accounts` route as defined in `routes/accounts-list.json`, displaying the request details and HTTP status code if `--verbose` is specified.

### Generate Default Routes

```bash
zeysdk generate
```

This will fetch the Swagger JSON and generate default route files in the `routes` directory.

### List All Routes

```bash
zeysdk routes
```

This will list all available route files in the `routes` directory in a table format.

## Directory Structure

```
zeyos-api/
├── config.json      # Configuration file storing instance details and tokens
└── routes/          # Directory containing generated route files
```

## License

This project is licensed under the MIT license-