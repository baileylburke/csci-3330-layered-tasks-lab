import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, test } from "node:test";
import app from "../app.js";

let server;
let baseUrl;

before(async () => {
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
        server.closeAllConnections();
    });
});

async function getTasks() {
    const response = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(response.status, 200);
    return (await response.json()).data;
}

function postTask(body) {
    return fetch(`${baseUrl}/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
}

test("GET returns the three original tasks with consistent fields", async () => {
    const response = await fetch(`${baseUrl}/api/tasks`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.deepEqual(await response.json(), {
        success: true,
        data: [
            { id: 1, title: "Take a shower", completed: false },
            { id: 2, title: "Get wingstop for dinner", completed: false },
            { id: 3, title: "Work on the project for 3330", completed: true }
        ]
    });
});

test("POST trims a title, generates an ID and persists an incomplete task", async () => {
    const response = await postTask({ title: "  Finish the lab  ", id: 1, completed: true });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
        success: true,
        data: { id: 4, title: "Finish the lab", completed: false }
    });
    assert.deepEqual((await getTasks()).at(-1), {
        id: 4, title: "Finish the lab", completed: false
    });
});

test("invalid titles return 400 without changing storage", async () => {
    const beforeTasks = await getTasks();
    const bodies = [{}, { title: "" }, { title: " \t\n " }, { title: 42 },
        { title: null }, { title: false }, { title: [] }, { title: {} }, []];
    for (const body of bodies) {
        const response = await postTask(body);
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
            success: false, message: "Title must be a non-empty string."
        });
    }
    assert.deepEqual(await getTasks(), beforeTasks);
});

test("missing bodies and wrong content types return 400", async () => {
    const beforeTasks = await getTasks();
    for (const options of [
        { method: "POST" },
        { method: "POST", headers: { "Content-Type": "text/plain" }, body: "title=Task" }
    ]) {
        const response = await fetch(`${baseUrl}/api/tasks`, options);
        assert.equal(response.status, 400);
        assert.equal((await response.json()).success, false);
    }
    assert.deepEqual(await getTasks(), beforeTasks);
});

test("malformed JSON and oversized bodies use the JSON error handler", async () => {
    const beforeTasks = await getTasks();
    for (const [body, expectedStatus] of [["{", 400], ["null", 400],
        [JSON.stringify({ title: "x".repeat(110000) }), 413]]) {
        const response = await fetch(`${baseUrl}/api/tasks`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body
        });
        assert.equal(response.status, expectedStatus);
        const result = await response.json();
        assert.equal(result.success, false);
        assert.equal(typeof result.message, "string");
    }
    assert.deepEqual(await getTasks(), beforeTasks);
});

test("concurrent requests receive unique sequential IDs and preserve Unicode", async () => {
    const beforeTasks = await getTasks();
    const results = await Promise.all(Array.from({ length: 10 }, async (_, index) => {
        const title = `Tarea ${index} ✓`;
        const response = await postTask({ title });
        assert.equal(response.status, 201);
        const { data } = await response.json();
        assert.equal(data.title, title);
        assert.equal(data.completed, false);
        return data;
    }));
    assert.deepEqual(results.map((task) => task.id).sort((a, b) => a - b),
        Array.from({ length: 10 }, (_, index) => beforeTasks.length + index + 1));
    assert.equal((await getTasks()).length, beforeTasks.length + 10);
});

test("unimplemented routes return 404 without changing tasks", async () => {
    const beforeTasks = await getTasks();
    for (const [method, path] of [["GET", "/api/missing"], ["DELETE", "/api/tasks/1"]]) {
        const response = await fetch(`${baseUrl}${path}`, { method });
        assert.equal(response.status, 404);
    }
    assert.deepEqual(await getTasks(), beforeTasks);
});
