import { useState } from "preact/hooks";

type FileInputProps = {
  id?: string;
  accept?: string;
  onChange?: (file: File | null) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  buttonText?: string;
};

const InputFile = ({
  id = "file-upload",
  accept = "image/jpeg,image/png,image/webp,image/gif",
  onChange,
  className = "",
  disabled = false,
  placeholder = "",
  buttonText = "Parcourir",
}: FileInputProps) => {
  const [fileName, setFileName] = useState<string>("");

  const handleFileChange = (e: Event & { currentTarget: HTMLInputElement }) => {
    const file = e.currentTarget.files?.[0] ?? null;
    setFileName(file?.name ?? "");
    onChange?.(file);
  };

  return (
    <label
      htmlFor={id}
      className={`flex items-center gap-3 cursor-pointer file-input file-input-bordered ${className} ${
        disabled ? "opacity-60 pointer-events-none" : ""
      }`}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => handleFileChange(e as any)}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex-1 text-left">
        {fileName ? (
          <span className="font-medium px-[5px]">{fileName}</span>
        ) : (
          <span className="opacity-60 px-[5px]">{placeholder}</span>
        )}
      </div>

      <div className="btn btn-sm text-black">{buttonText}</div>
    </label>
  );
};

export  {InputFile};
