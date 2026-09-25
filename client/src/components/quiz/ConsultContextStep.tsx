import { useState } from "react";
import Dropzone from "react-dropzone";
import { X } from "lucide-react";
import examplePhoto from "@/assets/example-photo.jpg";
import examplePlan from "@/assets/example-plan.jpg";

interface Props {
  roomPhoto: string;
  floorplanUrl: string;
  onPhotoUpload: (files: File[]) => void;
  onFloorplanUpload: (files: File[]) => void;
  isUploadingPhoto: boolean;
  isUploadingFloorplan: boolean;
}

// Guidance copy verbatim from the mockup (including its "furntiure" typo).
const PHOTO_TIPS = [
  ["Eliminate Clutter", "Make sure the room is free of clutter. The less furntiure the better"],
  ["Capture a Wide View", "Step back to show the whole space"],
  ["Let There Be Light", "Take photos during the day for good lighting"],
];
const PLAN_TIPS = [
  ["Keep it Simple", "Use plain paper and a black pen"],
  ["Basic Measurements", "Label the length and width of walls in feet or inches"],
  ["Include Door and Windows", "Mark where doors and windows are located so we know how furniture should flow."],
];

function ExampleModal({ title, tips, image, onClose }: { title: string; tips: string[][]; image: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 cc-reveal" role="dialog" aria-modal="true" aria-label={title} data-testid="example-modal" onClick={onClose}>
      <div className="w-full max-w-5xl bg-black" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end px-5 py-3 text-white">
          <button onClick={onClose} aria-label="Close" data-testid="button-close-example"><X className="w-5 h-5" /></button>
        </div>
        <div className="grid md:grid-cols-[1fr_1.8fr] bg-white">
          <div className="p-8 md:p-10">
            <h3 className="text-4xl mb-8" style={{ fontFamily: "var(--font-serif)" }}>{title}</h3>
            <div className="space-y-6">
              {tips.map(([h, b]) => (
                <div key={h}>
                  <p className="text-lg">{h}</p>
                  <p className="font-light">{b}</p>
                </div>
              ))}
            </div>
          </div>
          <img src={image} alt={title} className="w-full h-full object-cover" />
        </div>
        <div className="h-8" />
      </div>
    </div>
  );
}

function UploadBox({
  heading, addLabel, url, uploading, onDrop, onExample, testId,
}: { heading: string; addLabel: string; url: string; uploading: boolean; onDrop: (f: File[]) => void; onExample: () => void; testId: string }) {
  return (
    <div className="border border-[#231f20]/30 hover:border-[#231f20]/70 transition-colors duration-500 p-8 md:p-10 text-center flex flex-col items-center">
      <h3 className="text-3xl md:text-4xl leading-tight mb-8" style={{ fontFamily: "var(--font-serif)" }}>{heading}</h3>
      <Dropzone onDrop={onDrop} accept={{ "image/*": [".png", ".jpg", ".jpeg"] }} maxFiles={1} disabled={uploading}>
        {({ getRootProps, getInputProps }) => (
          <div {...getRootProps()}>
            <input {...getInputProps()} data-testid={`input-${testId}`} />
            <button type="button" className="cc-option !bg-[#7f807a] !text-white !border-[#7f807a] px-10 py-3 hover:!bg-[#5f6059]" data-testid={`button-${testId}`}>
              {uploading ? "Uploading..." : url ? "Replace" : addLabel}
            </button>
          </div>
        )}
      </Dropzone>
      {url && <img src={url} alt="Uploaded" className="mt-6 max-h-32 object-contain" data-testid={`preview-${testId}`} />}
      <button type="button" onClick={onExample} className="italic mt-6 text-[#57524f] hover:text-[#231f20] transition-colors" data-testid={`example-${testId}`}>See Example</button>
    </div>
  );
}

/** Step 9 (p13). Both uploads are optional. */
export default function ConsultContextStep(p: Props) {
  const [modal, setModal] = useState<"photo" | "plan" | null>(null);
  return (
    <div className="max-w-[1100px] mx-auto px-6 pt-12 md:pt-16 text-center">
      <h2 className="cc-heading" data-testid="heading-context">Environmental Context</h2>
      <p className="mt-6 text-lg font-light">Provide photo(s) and/or floorplan to synchronize our design logic with your physical space.</p>
      <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto mt-14">
        <UploadBox heading="Upload your photo(s)" addLabel="Add Photo" url={p.roomPhoto} uploading={p.isUploadingPhoto} onDrop={p.onPhotoUpload} onExample={() => setModal("photo")} testId="photo" />
        <UploadBox heading="Upload your floorplan" addLabel="Add Plan" url={p.floorplanUrl} uploading={p.isUploadingFloorplan} onDrop={p.onFloorplanUpload} onExample={() => setModal("plan")} testId="floorplan" />
      </div>
      {modal === "photo" && <ExampleModal title="Photo Example" tips={PHOTO_TIPS} image={examplePhoto} onClose={() => setModal(null)} />}
      {modal === "plan" && <ExampleModal title="Plan Example" tips={PLAN_TIPS} image={examplePlan} onClose={() => setModal(null)} />}
    </div>
  );
}
