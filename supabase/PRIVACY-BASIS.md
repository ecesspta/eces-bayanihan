# ECES Bayanihan: processing activities and proposed lawful basis

**Status: PROPOSED, PENDING REVIEW.** This is a working draft by a volunteer, not legal advice and not a compliance certification. It is meant to be reviewed by whoever the school or the Schools Division assigns, or by the National Privacy Commission's guidance materials. The section numbers refer to the Data Privacy Act of 2012 (RA 10173).

Registration consent covers the account and the SPTA services described in the notice. It is **not** blanket permission to publish children's photographs, private concerns or personal details.

| Activity | Information | Proposed basis (to be confirmed) | Notes |
|---|---|---|---|
| Parent account | Name, mobile, child's name, grade and section | Consent at registration (Sec. 12(a)) | The child's name is used to match the parent to the section. Withdrawal closes the account; records the SPTA must keep may stay. |
| Officer account and roles | Name, mobile, role, signatures | Legitimate interest of the SPTA in running its affairs (Sec. 12(f)); consent at sign-up | Officers sign up with an invite code. |
| Proposals, votes, resolutions, minutes | Proposal text, vote participation (not choices), signatures | Legitimate interest and SPTA recordkeeping duties (Sec. 12(f)); DepEd PTA guidelines | Ballot choices are never linked to a voter. |
| Published financial reports | Totals and purposes, no names | Legitimate interest in transparency (Sec. 12(f)) | Receipts and contributor details stay private. |
| Ordinary private concerns | Concern text, photos, sender (unless hidden) | Consent of the sender (Sec. 12(a)) and legitimate interest (Sec. 12(f)) | Seen by the chairperson and Vice-Chairperson, and an endorsed officer only for that case. |
| Child-protection reports | Concern text and photos, possibly about a child, may involve sensitive information | Protection of the life and health of the child (Sec. 13(c)); the school's duties under DepEd Order 40, s. 2012 | School only: the School Head and a designated, school-authorized secretary. The SPTA sees status only. |
| Device ID, sessions, security logs | Device ID, sign-in records, rate counters | Legitimate interest in security (Sec. 12(f)) | Never shown to any user. |
| Backups | Everything above | Same as the source record | Encrypted, custodian-held; see BACKUP.md. |

Facts still to confirm before the notice is final (shown as "To be confirmed" in the app; fill them in `PRIVACY_FACTS` in `app.js`):

1. Who is the Personal Information Controller: the SPTA, the school, or both.
2. The official privacy contact.
3. Verified service providers and storage locations. The app currently uses GitHub Pages (app files) and Supabase (database and attachments; the project's region should be confirmed in the Supabase dashboard).
4. The retention schedule for each kind of record.
