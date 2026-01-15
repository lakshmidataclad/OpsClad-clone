@gdrive_blueprint.route("/upload-expense", methods=["POST"])
def upload_expense():
    if "destination_credentials" not in session:
        return jsonify({"success": False, "message": "Drive not connected"}), 401

    try:
        file = request.files.get("file")
        transaction_id = request.form.get("transaction_id")

        if not file or not transaction_id:
            return jsonify({"success": False, "message": "Missing fields"}), 400

        creds = Credentials(**session["destination_credentials"])
        service = build("drive", "v3", credentials=creds)

        # 🔹 Ensure folders exist
        root_folder = get_or_create_output_folder(service)

        pending_folder_id = None
        query = f"name='Pending' and '{root_folder}' in parents and mimeType='application/vnd.google-apps.folder'"
        res = service.files().list(q=query, fields="files(id)").execute()
        if res["files"]:
            pending_folder_id = res["files"][0]["id"]
        else:
            pending_folder_id = service.files().create(
                body={
                    "name": "Pending",
                    "mimeType": "application/vnd.google-apps.folder",
                    "parents": [root_folder],
                },
                fields="id",
            ).execute()["id"]

        # 🔹 Upload file
        temp_path = f"/tmp/{file.filename}"
        file.save(temp_path)

        media = MediaFileUpload(temp_path, mimetype=file.mimetype)
        uploaded = service.files().create(
            body={
                "name": f"{transaction_id}-{file.filename}",
                "parents": [pending_folder_id],
            },
            media_body=media,
            fields="id",
        ).execute()

        os.remove(temp_path)

        file_id = uploaded["id"]
        drive_url = f"https://drive.google.com/file/d/{file_id}/view"

        return jsonify({
            "success": True,
            "fileId": file_id,
            "driveUrl": drive_url,
        })

    except Exception as e:
        print("Upload error:", e)
        return jsonify({"success": False, "message": str(e)}), 500
