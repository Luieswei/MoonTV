export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 1. 不再写死域名，而是从 Cloudflare 的环境变量中读取
  // 如果后台没设置这个变量，targetDomain 就是空的
  const targetDomain = context.env.REDIRECT_TARGET;

  // 2. 逻辑判断：
  // 只有当【设置了目标域名】且【当前访问的是 pages.dev 原生域】时，才跳转
  if (targetDomain && url.hostname.endsWith(".pages.dev")) {
    
    url.hostname = targetDomain;
    return Response.redirect(url.toString(), 301);
  }

  // 3. 如果没设置变量，或者已经是自定义域名了，就直接放行
  return context.next();
}
