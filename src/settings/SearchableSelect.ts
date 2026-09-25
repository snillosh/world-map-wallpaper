export interface SearchableSelectOption<Value> {
    readonly value: Value;
    readonly label: string;
}

interface SearchableSelectOptions<Value> {
    readonly inputId: string;
    readonly placeholder: string;
    readonly options: readonly SearchableSelectOption<Value>[];
    readonly onChange: (value: Value) => void;
}

let searchableSelectId = 0;

export class SearchableSelect<Value> {
    private readonly root: HTMLElement;
    private readonly input: HTMLInputElement;
    private readonly list: HTMLUListElement;
    private readonly listId: string;
    private readonly onChange: (value: Value) => void;
    private options: readonly SearchableSelectOption<Value>[];
    private filteredOptions: readonly SearchableSelectOption<Value>[] = [];
    private selectedValue: Value;
    private activeIndex = -1;
    private open = false;

    constructor(
        root: HTMLElement,
        selectedValue: Value,
        options: SearchableSelectOptions<Value>,
    ) {
        this.root = root;
        this.selectedValue = selectedValue;
        this.options = options.options;
        this.onChange = options.onChange;
        this.listId = `searchable-select-${searchableSelectId += 1}`;

        this.root.classList.add("searchable-select");

        this.input = document.createElement("input");
        this.input.id = options.inputId;
        this.input.type = "text";
        this.input.autocomplete = "off";
        this.input.placeholder = options.placeholder;
        this.input.setAttribute("role", "combobox");
        this.input.setAttribute("aria-autocomplete", "list");
        this.input.setAttribute("aria-haspopup", "listbox");
        this.input.setAttribute("aria-controls", this.listId);
        this.input.setAttribute("aria-expanded", "false");

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "searchable-select-toggle";
        toggle.tabIndex = -1;
        toggle.setAttribute("aria-label", "Show options");
        toggle.textContent = "⌄";

        this.list = document.createElement("ul");
        this.list.id = this.listId;
        this.list.className = "searchable-select-list";
        this.list.setAttribute("role", "listbox");
        this.list.hidden = true;

        this.root.append(this.input, toggle, this.list);

        this.input.addEventListener("focus", () => {
            this.show();
            this.input.select();
        });
        this.input.addEventListener("click", () => {
            if (!this.open) {
                this.show();
                this.input.select();
            }
        });
        this.input.addEventListener("input", () => {
            this.activeIndex = 0;
            this.renderOptions(this.input.value);
            this.show();
        });
        this.input.addEventListener("keydown", (event) => {
            this.handleKeyDown(event);
        });
        this.input.addEventListener("blur", () => {
            window.setTimeout(() => this.hide(), 0);
        });
        toggle.addEventListener("mousedown", (event) => event.preventDefault());
        toggle.addEventListener("click", () => {
            this.open ? this.hide() : this.show();
            this.input.focus();
        });
        document.addEventListener("pointerdown", (event) => {
            if (!this.root.contains(event.target as Node)) {
                this.hide();
            }
        });

        this.setValue(selectedValue);
    }

    public setOptions(options: readonly SearchableSelectOption<Value>[]): void {
        this.options = options;
        this.setValue(this.selectedValue);
        if (this.open) {
            this.renderOptions("");
        }
    }

    public setValue(value: Value): void {
        this.selectedValue = value;
        const option = this.options.find((item) => item.value === value);
        this.input.value = option?.label ?? String(value ?? "");
    }

    private show(): void {
        if (!this.open) {
            this.open = true;
            this.input.setAttribute("aria-expanded", "true");
            this.renderOptions("");
            const selectedIndex = this.filteredOptions.findIndex(
                (option) => option.value === this.selectedValue,
            );
            this.activeIndex = Math.max(0, selectedIndex);
            this.renderActiveOption();
        }
        this.list.hidden = false;
    }

    private hide(): void {
        if (!this.open) {
            return;
        }
        this.open = false;
        this.list.hidden = true;
        this.input.setAttribute("aria-expanded", "false");
        this.input.removeAttribute("aria-activedescendant");
        this.setValue(this.selectedValue);
    }

    private renderOptions(query: string): void {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        this.filteredOptions = this.options
            .filter((option) => {
                return option.label.toLocaleLowerCase().includes(normalizedQuery);
            })
            .toSorted((left, right) => {
                return matchPriority(left.label, normalizedQuery) -
                    matchPriority(right.label, normalizedQuery);
            });
        this.list.replaceChildren();

        if (this.filteredOptions.length === 0) {
            const empty = document.createElement("li");
            empty.className = "searchable-select-empty";
            empty.textContent = "No matches";
            this.list.append(empty);
            this.activeIndex = -1;
            return;
        }

        this.activeIndex = Math.min(
            Math.max(this.activeIndex, 0),
            this.filteredOptions.length - 1,
        );

        this.filteredOptions.forEach((option, index) => {
            const item = document.createElement("li");
            item.id = `${this.listId}-option-${index}`;
            item.setAttribute("role", "option");
            item.setAttribute(
                "aria-selected",
                String(option.value === this.selectedValue),
            );
            item.textContent = option.label;
            item.addEventListener("mousedown", (event) => event.preventDefault());
            item.addEventListener("click", () => this.select(option));
            item.addEventListener("mousemove", () => {
                this.activeIndex = index;
                this.renderActiveOption();
            });
            this.list.append(item);
        });

        this.renderActiveOption();
    }

    private renderActiveOption(): void {
        const items = this.list.querySelectorAll<HTMLElement>("[role=option]");
        items.forEach((item, index) => {
            item.classList.toggle("is-active", index === this.activeIndex);
        });

        const activeItem = items[this.activeIndex];
        if (activeItem !== undefined) {
            this.input.setAttribute("aria-activedescendant", activeItem.id);
            activeItem.scrollIntoView({ block: "nearest" });
        }
    }

    private handleKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                this.show();
                this.activeIndex = Math.min(
                    this.activeIndex + 1,
                    this.filteredOptions.length - 1,
                );
                this.renderActiveOption();
                break;
            case "ArrowUp":
                event.preventDefault();
                this.show();
                this.activeIndex = Math.max(this.activeIndex - 1, 0);
                this.renderActiveOption();
                break;
            case "Enter": {
                if (!this.open) {
                    return;
                }
                event.preventDefault();
                const option = this.filteredOptions[this.activeIndex];
                if (option !== undefined) {
                    this.select(option);
                }
                break;
            }
            case "Escape":
                event.preventDefault();
                this.hide();
                break;
        }
    }

    private select(option: SearchableSelectOption<Value>): void {
        this.selectedValue = option.value;
        this.onChange(option.value);
        this.hide();
    }
}

function matchPriority(label: string, query: string): number {
    if (query === "") {
        return 0;
    }

    const words = label.toLocaleLowerCase().split(/\s+/);
    return words.some((word) => word.startsWith(query)) ? 0 : 1;
}
