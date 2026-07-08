# WhatsApp Task Automation Bot

An automated WhatsApp Web assistant that helps teams manage daily task lists, compile interactive polls, track vote completions, and generate on-demand daily audit reports.

## Features

- **Automated Task Polls**: Detects numbered task lists in messages and automatically replies with interactive WhatsApp Polls.
- **Smart Name Extraction**: Automatically parses employee names from task headers (e.g. `Rahul Tasks`, `M S Arjun Today's Works`, `Tasks of Alice`) to use as poll titles and report headers.
- **Vote Completion Tracking**: Real-time listening to `'vote_update'` events. Integrates index-based fallback tracking to resolve selected options when names are omitted.
- **Group-wide Vote Aggregation**: Aggregates vote updates across all participants in the chat so team members can check/vote on shared tasks or admin-submitted polls.
- **On-demand Daily Audit Reports**: Command-based reports triggering for phrases like `report`, `todays report`, `yesterday report`, `status`, etc., listing all employee tasks and their completion checkmarks.
- **Daily Cron Job**: Sends an automated audit report to the group every day at 6:05 PM.
- **Beautiful QR Authentication UI**: Launches a local web dashboard to display the QR authentication code for linking devices.

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Keerthana-Vinod/report_generator.git
   cd report_generator
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the service**:
   ```bash
   npm start
   ```

4. **Link WhatsApp**:
   - Open `qr.html` in your browser.
   - Scan the QR code using WhatsApp on your phone (Linked Devices).

---

## Usage

1. Post your task list in the **"Work Status"** group chat:
   ```text
   Arjun Today's Works
   1. Setup database schema
   2. Build authentication API
   ```
2. The bot will automatically reply with a poll mapping to these options.
3. Check the options on the poll to mark them as completed.
4. Get report at any time by sending:
   - `todays report`
   - `yesterday report`
   - `give me the report`
   - `status`
