# Doll profile UI decision

- **Surface:** operational doll detail page.
- **User job:** identify the doll and its Amazon-search facts while comparing current offers by region.
- **Primary action:** refresh prices; the existing Amazon regional list remains the primary information surface.
- **Existing pattern:** `ChartCard`, `PageHeader`, shadcn `Card`, `Badge`, `Separator`.
- **Candidates considered:** local `ChartCard` composition, existing card/description layout, shadcn `Card` + `Badge` + `Separator` primitives.
- **Selected composition:** one profile `Card` beside the unchanged regional offer `Card`; the history chart moves to the following full-width section.
- **Desktop strategy:** `xl` two columns, 144px image, 24px section gap, no tabs or secondary navigation.
- **States:** real thumbnail, neutral placeholder, em dash for missing facts, existing Amazon empty/error states unchanged.
- **Deviation:** no extra registry block is required; every element is an installed shadcn primitive.
