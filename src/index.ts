/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export interface Env {
  REAL_OPENAI_KEY: string;
  DUMMY_WRAPPER_KEY: string;
  AI_GATEWAY_ENDPOINT_URL: string;
}

/**
 * Validates if a string is valid JSON.
 */
function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Handles API Errors 
 */
function handleApiError(type: string, code: string, message: string): Response {
  return Response.json(
    {
      error: {
        type,
        code,
        message
      }
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'content-type': 'application/json;charset=UTF-8',
      },
      status: 400 // Default to Bad Request for most errors
    }
  );
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestURL = new URL(request.url);

    // Validate environment variables
    if (!env.AI_GATEWAY_ENDPOINT_URL) {
      return handleApiError(
        'invalid_request_error', 
        'wrapper_custom_no_endpint_url_in_env', 
        '(OpenAI Wrapper) You does not provide gateway url in environment variables. Please add AI_GATEWAY_ENDPOINT_URL in Cloudflare Dashboard.'
      );
    }

    if (!env.DUMMY_WRAPPER_KEY) {
      return handleApiError(
        'invalid_request_error',
        'wrapper_custom_no_dummy_key_in_env',
        '(OpenAI Wrapper) You does not provide dummy wrapper key in environment variables. Please add DUMMY_WRAPPER_KEY in Cloudflare Dashboard.'
      );
    }

    const providedAuthorization = request.headers.get('Authorization');
    if (!providedAuthorization) {
      return handleApiError(
        'invalid_request_error',
        'wrapper_custom_no_dummy_key_in_authorization',
        '(OpenAI Wrapper) You does not provide dummy dummy key in Authorization.'
      );
    }

    const providedWrapperKey = providedAuthorization.split(' ').pop();
    if (providedWrapperKey !== env.DUMMY_WRAPPER_KEY) {
      return handleApiError(
        'invalid_request_error',
        'wrapper_custom_invalid_dummy_key',
        '(OpenAI Wrapper) You does not provide correct dummy key. Be noted that you should NOT provide real OpenAI key here, which is not accepted.'
      );
    }

    // Ensure Real OpenAI Key is set and not the same as the dummy key
    if (!env.REAL_OPENAI_KEY) {
      return handleApiError(
        'invalid_request_error',
        'wrapper_custom_no_real_key_in_env',
        '(OpenAI Wrapper) You does not provide real OpenAI key. Please add REAL_OPENAI_KEY in Cloudflare Dashboard.'
      );
    }

    if (env.REAL_OPENAI_KEY === env.DUMMY_WRAPPER_KEY) {
      return handleApiError(
        'invalid_request_error',
        'wrapper_custom_dummy_key_euals_to_real_key',
        '(OpenAI Wrapper) Dummy key cannot be the same with real OpenAI key, which is prevented for misusing real key in other places. Please change DUMMY_WRAPPER_KEY in Cloudflare Dashboard'
      );
    }

    // Proxy requests to actual OpenAI endpoint
    if (requestURL.pathname.startsWith('/v1')) {
      // ... (rest of your request forwarding code)
    } else {
      return handleApiError(
        'invalid_request_error',
        'unknown_url',
        '(OpenAI Wrapper) Your URL does not start with /v1'
      );
    }
  }
};
