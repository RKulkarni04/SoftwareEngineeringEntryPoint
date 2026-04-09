module.exports = {
    default: {
        import: [
            "features/support/world.js",
            "features/support/hooks.js",
            "features/step_definitions/auth_steps.js",
            "features/step_definitions/conversation_steps.js"
        ],
        format: ["progress"],
        formatOptions: { snippetInterface: "async" },
        publishQuiet: true
    }
};
