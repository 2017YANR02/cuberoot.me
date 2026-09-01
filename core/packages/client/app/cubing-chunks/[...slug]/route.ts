// The canonical search worker is generated into public/cubing-chunks before
// every dev and production build. This route is only a generic miss handler;
// keeping it prevents unknown chunk paths from entering language routing.
export function GET(): Response {
  return new Response('not found', { status: 404 });
}
