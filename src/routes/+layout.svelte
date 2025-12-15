<script>
	// Import the treeview styles from source during development
	import '$lib/styles/main.scss';
</script>

<slot />

<style>
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		padding: 2rem;
		background: #f7fafc;
		line-height: 1.6;
	}

	:global(.container) {
		max-width: 1200px;
		margin: 0 auto;
	}

	:global(.container-landing) {
		max-width: 900px;
		margin: 0 auto;
	}

	/* Header styling for example pages */
	:global(header.example-header) {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		padding: 2rem;
		border-radius: 12px;
		margin-bottom: 2rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	:global(h1) {
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}

	:global(.subtitle) {
		opacity: 0.9;
		font-size: 1.1rem;
	}

	:global(.back-link) {
		display: inline-block;
		color: white;
		text-decoration: none;
		margin-bottom: 1rem;
		opacity: 0.8;
		transition: opacity 0.2s;
	}

	:global(.back-link:hover) {
		opacity: 1;
	}

	/* Card styles */
	:global(.card) {
		background: white;
		border-radius: 12px;
		padding: 2rem;
		margin-bottom: 2rem;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	:global(.card h2) {
		margin-bottom: 1rem;
		color: #2d3748;
		font-size: 1.5rem;
	}

	:global(.card h3) {
		margin-bottom: 0.75rem;
		color: #4a5568;
		font-size: 1.25rem;
	}

	:global(.card p) {
		margin-bottom: 1rem;
		color: #666;
	}

	/* Description text */
	:global(.description) {
		color: #718096;
		margin-bottom: 1.5rem;
	}

	/* Form styling */
	:global(.form-group) {
		margin-bottom: 1.5rem;
	}

	:global(.form-group label),
	:global(.demo-label) {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: #333;
	}

	:global(.form-text) {
		display: block;
		margin-top: 0.25rem;
		font-size: 0.875rem;
		color: #666;
	}

	/* Demo areas */
	:global(.demo-area) {
		margin-bottom: 1.5rem;
	}

	/* Output display */
	:global(.output) {
		margin-top: 1rem;
	}

	:global(.output-label) {
		font-weight: 500;
		margin-bottom: 0.5rem;
		color: #4a5568;
	}

	:global(.output pre),
	:global(pre) {
		background: #f7fafc;
		padding: 1rem;
		border-radius: 6px;
		overflow-x: auto;
		font-size: 0.875rem;
		border: 1px solid #e2e8f0;
	}

	/* Code blocks */
	:global(.code-block) {
		margin: 1.5rem 0;
	}

	:global(.code-block pre) {
		background: #2d3748;
		color: #e2e8f0;
		padding: 1.5rem;
		border-radius: 8px;
		overflow-x: auto;
		font-size: 0.875rem;
		line-height: 1.6;
	}

	/* Inline code */
	:global(code) {
		background: #edf2f7;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-size: 0.9em;
		color: #667eea;
		font-family: 'Courier New', monospace;
	}

	/* Notes/Info boxes */
	:global(.note) {
		background: #edf2f7;
		padding: 1rem;
		border-radius: 6px;
		border-left: 4px solid #667eea;
		margin-top: 1rem;
	}

	:global(.note-title) {
		font-weight: 600;
		color: #667eea;
		margin-bottom: 0.5rem;
	}

	:global(.note ul) {
		margin-left: 1.5rem;
		margin-top: 0.5rem;
	}

	:global(.note li) {
		margin-bottom: 0.5rem;
	}

	/* Grid layouts */
	:global(.grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	:global(.grid-2) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 2rem;
	}

	/* Typography */
	:global(h2) {
		color: #2d3748;
		margin-bottom: 1rem;
	}

	:global(h3) {
		color: #4a5568;
		margin-bottom: 0.75rem;
	}

	:global(ul) {
		line-height: 1.8;
	}

	:global(li) {
		color: #4a5568;
	}

	/* Links */
	:global(a) {
		color: #667eea;
		text-decoration: none;
	}

	:global(a:hover) {
		text-decoration: underline;
	}

	/* Buttons */
	:global(button) {
		cursor: pointer;
	}

	:global(.btn) {
		display: inline-block;
		padding: 0.5rem 1rem;
		background: #667eea;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 0.875rem;
		cursor: pointer;
		transition: background 0.2s;
	}

	:global(.btn:hover) {
		background: #5a67d8;
	}

	:global(.btn-secondary) {
		background: #e2e8f0;
		color: #4a5568;
	}

	:global(.btn-secondary:hover) {
		background: #cbd5e0;
	}

	/* Footer */
	:global(footer) {
		text-align: center;
		padding: 2rem;
		color: #718096;
		font-size: 0.875rem;
	}

	:global(footer a) {
		color: #667eea;
	}

	/* Tree container */
	:global(.tree-container) {
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 1rem;
		min-height: 200px;
		background: white;
	}

	:global(.tree-container-tall) {
		min-height: 400px;
		max-height: 500px;
		overflow-x: visible;
		overflow-y: auto;
		/* Add padding to accommodate drop zones */
		padding-top: 2rem;
		padding-bottom: 2rem;
	}

	/* Side-by-side trees */
	:global(.trees-side-by-side) {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 2rem;
	}

	/* Controls */
	:global(.controls) {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	:global(.controls input[type="text"]),
	:global(.controls input[type="number"]) {
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	:global(.controls select) {
		padding: 0.5rem;
		border: 1px solid #e2e8f0;
		border-radius: 6px;
		font-size: 0.875rem;
	}

	/* Table styles */
	:global(table) {
		width: 100%;
		border-collapse: collapse;
		margin-top: 1rem;
	}

	:global(th),
	:global(td) {
		padding: 0.75rem;
		text-align: left;
		border-bottom: 1px solid #e2e8f0;
	}

	:global(th) {
		background: #f7fafc;
		font-weight: 600;
		color: #4a5568;
	}

	:global(td code) {
		background: #edf2f7;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
	}

	/* Responsive */
	@media (max-width: 768px) {
		:global(body) {
			padding: 1rem;
		}

		:global(h1) {
			font-size: 2rem;
		}

		:global(.grid),
		:global(.grid-2) {
			grid-template-columns: 1fr;
		}

		:global(.trees-side-by-side) {
			grid-template-columns: 1fr;
		}

		:global(.card) {
			padding: 1.5rem;
		}
	}

	/* Landing page specific styles */
	:global(.landing-body) {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	:global(.landing-header) {
		text-align: center;
		margin-bottom: 3rem;
		color: white;
	}

	:global(.landing-header h1) {
		font-size: 3rem;
		font-weight: 700;
		margin-bottom: 0.5rem;
		text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
	}

	:global(.landing-header .subtitle) {
		font-size: 1.25rem;
		opacity: 0.9;
		font-weight: 300;
	}

	:global(.version-badge) {
		display: inline-block;
		background: rgba(255, 255, 255, 0.2);
		padding: 0.25rem 0.75rem;
		border-radius: 12px;
		font-size: 0.875rem;
		margin-top: 0.5rem;
		backdrop-filter: blur(10px);
	}

	:global(.cards-grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 2rem;
	}

	:global(.landing-card) {
		background: white;
		border-radius: 16px;
		padding: 2rem;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
		transition: transform 0.3s ease, box-shadow 0.3s ease;
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		display: block;
	}

	:global(.landing-card:hover) {
		transform: translateY(-8px);
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
		text-decoration: none;
	}

	:global(.card-icon) {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	:global(.card-title) {
		font-size: 1.5rem;
		font-weight: 600;
		margin-bottom: 0.5rem;
		color: #2d3748;
	}

	:global(.card-description) {
		color: #718096;
		line-height: 1.6;
		margin-bottom: 1rem;
	}

	:global(.card-features) {
		list-style: none;
		margin-top: 1rem;
	}

	:global(.card-features li) {
		padding: 0.5rem 0;
		border-top: 1px solid #e2e8f0;
		font-size: 0.875rem;
		color: #4a5568;
		display: flex;
		align-items: center;
	}

	:global(.card-features li:before) {
		content: "\2713";
		color: #667eea;
		font-weight: bold;
		margin-right: 0.5rem;
	}

	:global(.landing-footer) {
		text-align: center;
		margin-top: 3rem;
		color: white;
		opacity: 0.8;
		font-size: 0.875rem;
	}

	:global(.landing-footer a) {
		color: white;
		text-decoration: underline;
	}
</style>
