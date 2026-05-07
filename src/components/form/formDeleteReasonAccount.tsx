//import des hooks
import { useRef, useState } from "preact/hooks";
import { useForm } from "react-hook-form";

//import des librairies
import axios from "axios";

//import des composants enfants
import { Loader } from "@/components/loader/Loader";

//import des fonctions
import { localOrProd } from "@/utils/localOrProd";
import { axiosError } from "@/utils/axiosError";

function formDeleteReasonAccount({ content }) {
  return (
    <form>
      <h2></h2>
      <fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
        <legend className="fieldset-legend">Cancel options</legend>
        <label className="label">
          <input type="checkbox" className="checkbox" />
          {content.expensive}
        </label>
        <label className="label">
          <input type="checkbox" className="checkbox" />
          {content.no_more_use}
        </label>
        <label className="label">
          <input type="checkbox" className="checkbox" />
          {content.bad_quality_result}
        </label>
        <label className="label">
          <input type="checkbox" className="checkbox" />
          {content.difficult}
        </label>
        <label className="label">
          <input type="checkbox" className="checkbox" />

          {content.bad_UX}
        </label>
        <label className="label">
          <input type="checkbox" className="checkbox" />
          {content.found_alternative}
        </label>
        <label className="label">
          <textarea
            className="textarea"
            placeholder={content.placeholder}
          ></textarea>
          {content.other_reason}
        </label>
      </fieldset>
      <button type="submit">{content.button_submit}</button>
      <button type="button">{content.button_close}</button>
      <p>{content.congratualtion}</p>
    </form>
  );
}

export { formDeleteReasonAccount };
