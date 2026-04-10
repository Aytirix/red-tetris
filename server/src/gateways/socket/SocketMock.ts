import { readFileSync } from "node:fs";
import type { Socket } from "socket.io";

interface WsDocEvent {
	name: string;
	direction: "front-to-back" | "back-to-front";
	response?: string;
	responseName?: string;
}

const docsPath = new URL("../../../ws-docs.json", import.meta.url);
const wsDocs = JSON.parse(readFileSync(docsPath, "utf-8")) as WsDocEvent[];
const mockableEvents = new Map(
	wsDocs
		.filter((event) => event.direction === "front-to-back" && event.responseName && event.response)
		.map((event) => [event.name, event]),
);
const DOCS_WS_INTERNAL_EVENT_PREFIX = "__docsWs:";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValueOfType(type: string, value: unknown): boolean {
	switch (type) {
		case "string":
			return typeof value === "string";
		case "boolean":
			return typeof value === "boolean";
		case "number":
			return typeof value === "number";
		case "null":
			return value === null;
		case "object":
			return isRecord(value);
		case "array":
			return Array.isArray(value);
		default:
			return false;
	}
}

function getDefaultValue(type: string): unknown {
	switch (type) {
		case "string":
			return "";
		case "boolean":
			return false;
		case "number":
			return 0;
		case "null":
			return null;
		case "object":
			return {};
		case "array":
			return [];
		default:
			return null;
	}
}

function resolveTemplate(template: unknown, input: unknown): unknown {
	if (typeof template === "string" && template.startsWith("__TYPE_")) {
		const type = template.replace("__TYPE_", "").replace("__", "");
		return isValueOfType(type, input) ? input : getDefaultValue(type);
	}

	if (Array.isArray(template)) {
		const source = Array.isArray(input) ? input : [];
		return template.map((item, index) => resolveTemplate(item, source[index]));
	}

	if (isRecord(template)) {
		const source = isRecord(input) ? input : {};
		return Object.fromEntries(
			Object.entries(template).map(([key, value]) => [key, resolveTemplate(value, source[key])]),
		);
	}

	return template;
}

function normalizeSchema(schema: string): string {
	return schema
		.replace(/([{,]\s*)([A-Za-z0-9_:-]+)\s*:/g, '$1"$2":')
		.replace(/:\s*(string|boolean|number|null|object|array)\b/g, ': "__TYPE_$1__"')
		.replace(/,(\s*[}\]])/g, "$1");
}

function buildMockResponse(schema: string, input: unknown): unknown {
	try {
		const template = JSON.parse(normalizeSchema(schema)) as unknown;
		return resolveTemplate(template, input);
	} catch {
		return {};
	}
}

export function registerSocketMock(socket: Socket): void {
	socket.on(`${DOCS_WS_INTERNAL_EVENT_PREFIX}emitMockResponse`, (payload: unknown) => {
		if (!isRecord(payload)) return;
		if (typeof payload.eventName !== "string") return;
		if (typeof payload.responseName !== "string") return;

		const doc = mockableEvents.get(payload.eventName);
		if (!doc?.responseName || doc.responseName !== payload.responseName) return;

		if (typeof payload.response === "undefined") {
			socket.emit(doc.responseName, buildMockResponse(doc.response, payload.requestPayload));
			return;
		}

		socket.emit(doc.responseName, payload.response);
	});
}
