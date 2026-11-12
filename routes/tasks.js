import express from "express";

const router = express.Router();

const db = [
    { id: 1, title: "Take a shower", completed: false },
    { id: 2, title: "Get wingstop for dinner", completed: false },
    { id: 3, title: "Work on the project for 3330", completed: true }
];

function isGoodStringParam(param) {
    return typeof param === "string" && param.trim().length > 0;
}

router.get("/", (req, res, next) => {
    try {
        res.status(200).json({
            success: true,
            data: db
        });
    } catch (error) {
        next(error);
    }
});

router.post("/", (req, res, next) => {
    try {
        const title = req.body?.title;
        if (!isGoodStringParam(title)) {
            return res.status(400).json({
                success: false,
                message: "Title must be a non-empty string."
            });
        }

        const newTask = {
            id: db.length ? Math.max(...db.map((task) => task.id)) + 1 : 1,
            title: title.trim(),
            completed: false
        };
        db.push(newTask);

        res.status(201).json({
            success: true,
            data: newTask
        });
    } catch (error) {
        next(error);
    }
});

export default router;
