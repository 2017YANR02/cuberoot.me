"use client";

import { useState } from "react";
import { FileUpload } from "./FileUpload";

// A controlled input + matching upload zone. Uploading replaces the input value.
// Used in admin forms to combine a URL textbox with a file upload helper.
export function UploadField({
  id,
  name,
  defaultValue,
  placeholder,
  accept,
  uploadLabel,
  uploadHint,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  accept?: string;
  uploadLabel?: string;
  uploadHint?: string;
}) {
  const [value, setValue] = useState(defaultValue ?? "");
  return (
    <div>
      <input
        id={id}
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-line bg-white px-3 py-2 text-[14px] outline-none focus:border-brand transition"
      />
      <FileUpload
        accept={accept}
        label={uploadLabel}
        hint={uploadHint}
        onUploaded={(url) => setValue(url)}
      />
    </div>
  );
}
