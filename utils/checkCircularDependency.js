const Task = require("../models/task");

async function hasCircularDependency(dependsOn, newTaskId = null) {
    const visited = new Set();

    async function dfs(taskId) {
        if (newTaskId && taskId.toString() === newTaskId.toString()) {
            return true;
        }

        if (visited.has(taskId.toString())) return false;
        visited.add(taskId.toString());

        const task = await Task.findById(taskId).select("dependsOn");
        if (!task || !task.dependsOn?.length) return false;

        for (const dep of task.dependsOn) {
            if (await dfs(dep)) return true;
        }
        return false;
    }

    for (const dep of dependsOn) {
        if (await dfs(dep)) return true;
    }

    return false;
}

module.exports = hasCircularDependency;
