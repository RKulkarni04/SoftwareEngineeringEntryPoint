(function (global, factory) {
    if (typeof module !== "undefined" && module.exports) {
        module.exports = factory();
    } else {
        global.ChatSidebarLogic = factory();
    }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    function normalizeModels(models) {
        return Array.isArray(models) ? models.filter(Boolean) : [];
    }

    function createInitialSelection(models) {
        const normalizedModels = normalizeModels(models);
        const selectedModels = normalizedModels.slice(0, 2);

        return {
            primaryModel: normalizedModels[0] || null,
            selectedModels
        };
    }

    function createSingleSelection(model) {
        if (!model) {
            return {
                primaryModel: null,
                selectedModels: []
            };
        }

        return {
            primaryModel: model,
            selectedModels: [model]
        };
    }

    function toggleModelSelection(currentSelection, model, isSelected) {
        const selection = new Set(normalizeModels(currentSelection));

        if (isSelected) {
            selection.add(model);
        } else {
            selection.delete(model);
        }

        return Array.from(selection);
    }

    function buildInputHint(mode, selectedCount) {
        if (mode === "multi") {
            return `Press Enter to send · <span class="multi-hint">Comparing ${selectedCount} model${selectedCount !== 1 ? "s" : ""}</span>`;
        }

        return "Press Enter to send · Your Royal Advisor awaits";
    }

    return {
        createInitialSelection,
        createSingleSelection,
        toggleModelSelection,
        buildInputHint
    };
});
