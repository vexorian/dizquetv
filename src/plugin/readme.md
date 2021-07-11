## Hooks
The hooks allow you to tap into dizquetv at specific points to change how dizquetv behaves without editing any core files.

The hooks has a path pattern, like: `dizquetv:<nameSpace>:<function>`

Example:
- Filter all requests, register your function on `dizquetv:Server:AllRequest` event.
- Change or validate Args of ffmpeg spaw, register your function on `dizquetv:Server:FFMPEG:Spaw` event.

### Server

#### VersionJS <data>

Called: When file `/version.js` are requested

Receive:

- data: JavaScript content of script used to set version name

Return: data

#### AllRequest <req, res, next>

Called: Over any request

Receive:
- req: request information of Express
- res: response information of Express
- next: NextFunction of Express

Return: req. res, next

#### CustomWeb

Called: on `/` main route

Receive: null

Return: folder path of web application

#### OnShutdown

Called: on service are shutdown

Receive: null

Return: null

#### FFMPEG

##### INIT <opts, channel>
Called: when ffmpeg class are started

Receive:
- opts
- channel

Return: opts, channel

##### SPAW <ffmpegArgs>
##### KILL <Signal>
##### OnError <code, signal>
##### OnExit <code, signal>

#### FFMPEG TEXT

##### SPAW <ffmpegArgs>
##### Close
##### Kill

#### Video

##### m3u8 <data>
##### playlist <data>

#### XMLTV

##### writeDocStart <XMLWriter>
##### writeProgramme <channel, program, XMLWriter, xmlSettings>
##### writeDocEnd <XMLWriter>

### WEB
- Custom JS
- Custom Css
- Register Page
- Register Settings

## Creating a Plugin

### Plugin Basics
#### First Steps
At it's simplest, a plugin is a JS file with a objects of functions. You need to create a directory to hold your plugin so that all of your plugin’s files are neatly organized in one place.

To get started creating a new plugin, follow the steps below.

- Navigate to the .dizquetv directory.
- Open the plugins directory.
- Create a new directory and name it using kebab-case.
- Open the new plugin’s directory.
- Create a index.js file.

Now that you’re editing your new JS file, you’ll need to add a plugin module.exports pattern. This is a specially formatted object that contains metadata about the plugin, such as its name and hooks used. 

```js
module.exports = {
    name: 'Hello',
    hook: {
        'dizquetv:Server:AllRequest': () => {
            console.log('This Is HOOK!!')
        }
    },
}
```

The module.exports must comply with the object requirements, and at the very least, contain the name of the plugin.

After you save the file, you should be able to see your plugin listed in your dizquetv ui. Go to UI, and click Plugins on the top navigation pane. This page displays a listing of all the plugins your app has and a list of community's plugins curated by dizquetv staff. Your new plugin should now be in that list!

#### Configuration Page
A configuration page is a dynamically registered page with a one web-component.

To have a configuration page, you need to register a `.js` on hook to run on browser, where the file has a `customElements.define()` registering your element on browser, and register this element tag on settings elements hook.

Look to example.

my-plugin-name/my-settings-page.js
```js
// ES6 Classes to Define the new Element Behavior
class SettingsPageExample extends HTMLElement {
    constructor() {
        super();
        // Page init actions
    }

    // Settings functions
}

window.customElements.define('my-settings-page-element', SettingsPageExample);

```

my-plugin-name/index.js
```js
module.exports = {
    name: 'Super Cool Plugin',
    hook: {
        'dizquetv:WEB:RegisterSettings': () => {
            return {
                element: 'my-settings-page-element'
            }
        }
    },
}
```

For a real example, look on [example folder](example), the dark-mode plugin is a full example.