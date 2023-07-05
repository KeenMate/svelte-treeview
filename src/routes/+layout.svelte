<script>
	// Global styles
	import '../assets/main.scss';
</script>

<nav class="navbar navbar-expand-lg navbar-light bg-light">
	<a class="navbar-brand" href="#">Navbar</a>
	<button
		class="navbar-toggler"
		type="button"
		data-toggle="collapse"
		data-target="#navbarSupportedContent"
		aria-controls="navbarSupportedContent"
		aria-expanded="false"
		aria-label="Toggle navigation"
	>
		<span class="navbar-toggler-icon" />
	</button>

	<div class="collapse navbar-collapse" id="navbarSupportedContent">
		<ul class="navbar-nav mr-auto">
			<li class="nav-item active">
				<a class="nav-link" href="/about">Home</a>
			</li>
			<li class="nav-item active">
				<a class="nav-link" href="/files">Files</a>
			</li>
			<li class="nav-item active">
				<a class="nav-link" href="/file-from-package">Files from npm package</a>
			</li>
			<li class="nav-item active">
				<a class="nav-link" href="/dhl-demo">DHL demo</a>
			</li>
		</ul>
	</div>
</nav>
<slot />
