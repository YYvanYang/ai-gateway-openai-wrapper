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

// 定义请求错误响应的结构
interface RequestError {
  type: string;
  code: string;
  message: string;
  param: null;
}

// 判断一个字符串是否为 JSON 格式
function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

// 返回错误响应
function createErrorResponse(error: RequestError, status: number): Response {
  const responseHeader = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json;charset=UTF-8',
  };

  return new Response(JSON.stringify(error), {
    headers: responseHeader,
    status,
  });
}

// 处理请求
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const allowedOrigin = request.headers.get('Access-Control-Allow-Origin') || '*';
  const realOpenAIKey = env.REAL_OPENAI_KEY;
  const dummyWrapperKey = env.DUMMY_WRAPPER_KEY;
  const aiGatewayEndpointUrl = env.AI_GATEWAY_ENDPOINT_URL;

  // 检查是否提供了网关端点 URL
  if (!aiGatewayEndpointUrl) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'wrapper_custom_no_endpoint_url_in_env',
      message: '(OpenAI Wrapper) You do not provide a gateway URL in environment variables. Please add AI_GATEWAY_ENDPOINT_URL in the Cloudflare Dashboard.',
      param: null,
    };
    return createErrorResponse(error, 400);
  }

  // 检查是否提供了虚拟密钥
  if (!dummyWrapperKey) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'wrapper_custom_no_dummy_key_in_env',
      message: '(OpenAI Wrapper) You do not provide a dummy wrapper key in environment variables. Please add DUMMY_WRAPPER_KEY in the Cloudflare Dashboard.',
      param: null,
    };
    return createErrorResponse(error, 400);
  }

  // 检查请求是否包含授权信息
  const providedAuthorization = request.headers.get('Authorization');
  if (!providedAuthorization) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'wrapper_custom_no_dummy_key_in_authorization',
      message: '(OpenAI Wrapper) You do not provide a dummy key in the Authorization header.',
      param: null,
    };
    return createErrorResponse(error, 401);
  }

  // 验证虚拟密钥
  const providedWrapperKey = providedAuthorization.split(' ').pop();
  if (providedWrapperKey !== dummyWrapperKey) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'wrapper_custom_invalid_dummy_key',
      message: '(OpenAI Wrapper) You do not provide a correct dummy key. Note that you should NOT provide a real OpenAI key here, as it is not accepted.',
      param: null,
    };
    return createErrorResponse(error, 400);
  }

  // 检查是否提供了真实的 OpenAI 密钥
  if (!realOpenAIKey) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'wrapper_custom_no_real_key_in_env',
      message: '(OpenAI Wrapper) You do not provide a real OpenAI key. Please add REAL_OPENAI_KEY in the Cloudflare Dashboard.',
      param: null,
    };
    return createErrorResponse(error, 500);
  }

  // 检查虚拟密钥和真实密钥是否相同
  if (realOpenAIKey === dummyWrapperKey) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'wrapper_custom_dummy_key_equals_to_real_key',
      message: '(OpenAI Wrapper) The dummy key cannot be the same as the real OpenAI key, which is prevented for misusing the real key elsewhere. Please change DUMMY_WRAPPER_KEY in the Cloudflare Dashboard.',
      param: null,
    };
    return createErrorResponse(error, 500);
  }

  // 检查请求路径是否以 /v1 开头
  const requestURL = new URL(request.url);
  if (!requestURL.pathname.startsWith('/v1')) {
    const error: RequestError = {
      type: 'invalid_request_error',
      code: 'unknown_url',
      message: '(OpenAI Wrapper) Your URL does not start with /v1',
      param: null,
    };
    return createErrorResponse(error, 400);
  }

  // 转发请求到 OpenAI API 网关
  const trimmedURL = aiGatewayEndpointUrl + requestURL.pathname.substring('/v1'.length);
  const gptRequest = new Request(trimmedURL, {
    headers: request.headers,
    method: request.method,
    body: request.body,
    redirect: 'follow',
  });
  gptRequest.headers.set('Authorization', `Bearer ${realOpenAIKey}`);

  try {
    // @ts-ignore: linter will report some attributes not found. But that's okay.
    return await fetch(gptRequest);
  } catch (error) {
    console.error('Error forwarding request to OpenAI API:', error);
    const errorResponse: RequestError = {
      type: 'internal_server_error',
      code: 'wrapper_forwarding_failed',
      message: '(OpenAI Wrapper) Failed to forward request to OpenAI API.',
      param: null,
    };
    return createErrorResponse(errorResponse, 500);
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env);
  },
};
