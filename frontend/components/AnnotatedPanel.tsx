"use client";

type Highlight = {
  id: string;
  text: string;
  note?: string | null;
  color: string;
  page_number: number;
};

const RAINBOW_GRADIENT =
  "linear-gradient(135deg, #ff8a80, #ffd180, #ffff8d, #ccff90, #82b1ff, #b388ff, #f8bbd0)";

function ColorSwatch({ color }: { color: string }) {
  const isRainbow = color === "rainbow";
  return (
    <span
      className="inline-block h-3 w-3 flex-shrink-0 rounded-full border border-outline-variant/60"
      style={isRainbow ? { backgroundImage: RAINBOW_GRADIENT } : { backgroundColor: color }}
    />
  );
}

export default function AnnotatedPanel({
  highlights,
  onJumpToPage,
  onDelete,
}: {
  highlights: Highlight[];
  onJumpToPage: (page: number) => void;
  onDelete: (id: string) => void;
}) {
  const pageGroups = new Map<number, Highlight[]>();
  for (const h of highlights) {
    const group = pageGroups.get(h.page_number);
    if (group) {
      group.push(h);
    } else {
      pageGroups.set(h.page_number, [h]);
    }
  }
  const sortedPages = Array.from(pageGroups.keys()).sort((a, b) => a - b);

  return (
    <div className="flex h-full w-full flex-col">
      <div className="p-4 md:p-6 border-b border-outline-variant flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-primary-container"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            ink_highlighter
          </span>
          <h3 className="font-headline-md text-lg md:text-headline-md tracking-tight text-on-surface">
            Annotated
          </h3>
        </div>
        <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
          {highlights.length} {highlights.length === 1 ? "note" : "notes"}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        {highlights.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <p className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant max-w-xs">
              No annotations yet — highlight text in the PDF to add one.
            </p>
          </div>
        ) : (
          <div className="space-y-8 max-w-3xl mx-auto">
            {sortedPages.map((page) => (
              <div key={page}>
                <h4 className="mb-3 font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant">
                  Page {page}
                </h4>
                <div className="space-y-3">
                  {pageGroups.get(page)!.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => onJumpToPage(h.page_number)}
                      className="group cursor-pointer rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm transition-colors hover:bg-surface-container-low"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                          <span className="mt-1.5">
                            <ColorSwatch color={h.color} />
                          </span>
                          <div className="flex-1 min-w-0">
                            {h.note && (
                              <p className="font-body-md text-sm text-on-surface mb-1.5 break-words">
                                {h.note}
                              </p>
                            )}
                            <blockquote className="border-l-2 border-primary-fixed bg-surface-container-low px-3 py-1.5 text-xs italic text-on-surface-variant rounded-r-sm line-clamp-3">
                              “{h.text}”
                            </blockquote>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(h.id);
                          }}
                          title="Delete annotation"
                          className="p-1.5 rounded-full text-secondary opacity-0 group-hover:opacity-100 hover:bg-surface-container hover:text-error transition-all flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
