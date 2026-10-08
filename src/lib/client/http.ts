export async function getErrorMessage(response: Response): Promise<string> {
	const body = (await response.json().catch(() => null)) as
		| { error?: string; message?: string }
		| null;

	return body?.error ?? body?.message ?? `Request failed with status ${response.status}.`;
}
