const {
    createInitialSelection,
    createSingleSelection,
    toggleModelSelection,
    buildInputHint
} = require("../frontend/chatSidebarLogic");

describe("chat sidebar logic", () => {
    describe("createInitialSelection", () => {
        it("uses the first model as the primary model", () => {
            const selection = createInitialSelection(["llama3", "mistral", "phi3"]);

            expect(selection.primaryModel).toBe("llama3");
        });

        it("preselects the first two models for quick compare mode access", () => {
            const selection = createInitialSelection(["llama3", "mistral", "phi3"]);

            expect(selection.selectedModels).toEqual(["llama3", "mistral"]);
        });

        it("returns an empty selection when no models are available", () => {
            const selection = createInitialSelection([]);

            expect(selection.primaryModel).toBeNull();
            expect(selection.selectedModels).toEqual([]);
        });
    });

    describe("createSingleSelection", () => {
        it("activates exactly one model in single mode", () => {
            const selection = createSingleSelection("mistral");

            expect(selection.primaryModel).toBe("mistral");
            expect(selection.selectedModels).toEqual(["mistral"]);
        });
    });

    describe("toggleModelSelection", () => {
        it("adds a model when compare mode selection is turned on", () => {
            const selection = toggleModelSelection(["llama3"], "phi3", true);

            expect(selection).toEqual(["llama3", "phi3"]);
        });

        it("removes a model when compare mode selection is turned off", () => {
            const selection = toggleModelSelection(["llama3", "mistral"], "mistral", false);

            expect(selection).toEqual(["llama3"]);
        });

        it("does not duplicate a model that is already selected", () => {
            const selection = toggleModelSelection(["llama3"], "llama3", true);

            expect(selection).toEqual(["llama3"]);
        });
    });

    describe("buildInputHint", () => {
        it("shows the single-mode hint when compare mode is off", () => {
            expect(buildInputHint("single", 1)).toBe("Press Enter to send · Your Royal Advisor awaits");
        });

        it("shows the compare hint with the selected model count", () => {
            expect(buildInputHint("multi", 3)).toBe(
                'Press Enter to send · <span class="multi-hint">Comparing 3 models</span>'
            );
        });

        it("uses the singular label when one compare model is selected", () => {
            expect(buildInputHint("multi", 1)).toBe(
                'Press Enter to send · <span class="multi-hint">Comparing 1 model</span>'
            );
        });
    });
});
