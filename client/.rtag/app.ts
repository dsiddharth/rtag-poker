import { RtagClient } from "./client";
import * as Types from "./types";
import Vue from "vue";
import VueRouter from "vue-router";
import Toasted from "vue-toasted";
import vSelect from "vue-select";
import Card from "../plugins/Card";

Vue.use(VueRouter);
Vue.use(Toasted, { position: "top-center", duration: 2000 });
Vue.component("v-select", vSelect);

window.customElements.define("card-plugin", Card);

const DELETED = Symbol();

function patch(obj: any, val: any) {
  Object.entries(val).forEach(([k, v]) => {
    if (typeof v === "object" && k in obj && obj[k] !== undefined) {
      patch(obj[k], v);
    } else if (v === DELETED) {
      obj.splice(Number(k), 1);
    } else {
      Vue.set(obj, k, v);
    }
  });
}

Vue.component("method-form", {
  props: { method: String },
  data() {
    return { value: {}, valid: true, hack: true };
  },
  template: `<div class="form" :id="method">
      <h1 class="heading">{{method}}</h1>
      <slot v-if="hack" :value="{[method]: value}" :update="update"></slot>
      <button type="button" class="button submit" @click="submit">
        <span class="button-text">Submit</span>
      </button>
    </div>`,
  methods: {
    update(arg: string, value: any, valid: boolean) {
      patch(this.value, value);
      this.valid = valid;
    },
    async submit() {
      if (!this.valid) {
        this.$toasted.error("Required fields missing");
        return;
      }
      const client: RtagClient = this.$parent.$data.client;
      const res: string | undefined = await client[this.method](this.value);
      if (res !== undefined) {
        this.$toasted.error(JSON.stringify(res));
      } else {
        this.value = {};
        this.hack = false;
        this.$nextTick(() => {
          this.hack = true;
        });
      }
    },
  },
});

Vue.component("object-input", {
  props: { arg: String, required: Boolean, value: { type: Object, default: () => ({}) } },
  data: () => ({ isOpen: false, invalidArgs: new Set<string>() }),
  template: `<div class="object-input">
      <div v-if="this.required">
        <slot :value="value ?? {}" :update="update"></slot>
      </div>
      <div v-else>
        <div v-if="this.isOpen">
          <slot :value="value ?? {}" :update="update"></slot>
          <button class="button" type="button" @click="isOpen = false">
            <span class="button-text">Remove</span>
          </button>
        </div>
        <div v-else>
          <button class="button" type="button" @click="isOpen = true">
            <span class="button-text">Add</span>
          </button>
        </div>
      </div>
    </div>`,
  methods: {
    update(arg: string, value: any, valid: boolean) {
      this.invalidArgs[valid ? "delete" : "add"](arg);
      this.$emit("update", this.arg, { [arg]: value }, this.invalidArgs.size === 0);
    },
  },
});

Vue.component("array-input", {
  props: { arg: String, required: Boolean, value: { type: Array, default: () => [] } },
  data: () => ({ invalidArgs: new Set<string>() }),
  template: `<div class="array-input">
      <div class="form-group array-item" v-for="(v, i) in value">
        <div class="stretch-form-input">
          <slot :arg="i.toString()" :value="v" :update="update"></slot>
        </div>
        <button class="button" type="button" @click="moveItemUp(i)">&#8593;</button>
        <button class="button" type="button" @click="moveItemDown(i)">&#8595;</button>
        <button class="button danger" type="button" @click="deleteItem(i)">x</button>
      </div>
      <button class="button" type="button" @click="addItem()">
        <span class="button-text">Add</span>
      </button>
    </div>`,
  created() {
    this.$emit("update", this.arg, this.value, !this.required);
  },
  methods: {
    update(arg: string, value: any, valid: boolean) {
      this.invalidArgs[valid ? "delete" : "add"](arg);
      this.$emit("update", this.arg, { [Number(arg)]: value }, this.invalidArgs.size === 0);
    },
    addItem() {
      this.$emit("update", this.arg, { [this.value.length]: undefined }, false);
    },
    moveItemUp(i: number) {
      if (i > 0) {
        this._swapsArgs(i.toString(), (i - 1).toString());
        this.$emit("update", this.arg, { [i]: this.value[i - 1], [i - 1]: this.value[i] }, this.invalidArgs.size === 0);
      }
    },
    moveItemDown(i: number) {
      if (i < this.value.length - 1) {
        this._swapsArgs(i.toString(), (i + 1).toString());
        this.$emit("update", this.arg, { [i]: this.value[i + 1], [i + 1]: this.value[i] }, this.invalidArgs.size === 0);
      }
    },
    deleteItem(i: number) {
      this.invalidArgs.delete(i.toString());
      this.$emit(
        "update",
        this.arg,
        { [i]: DELETED },
        this.invalidArgs.size === 0 && (!this.required || this.value.length > 1)
      );
    },
    _swapsArgs(arg1: string, arg2: string) {
      if (this.invalidArgs.has(arg1) && !this.invalidArgs.has(arg2)) {
        this.invalidArgs.delete(arg1);
        this.invalidArgs.add(arg2);
      } else if (this.invalidArgs.has(arg2) && !this.invalidArgs.has(arg1)) {
        this.invalidArgs.delete(arg2);
        this.invalidArgs.add(arg1);
      }
    },
  },
});

Vue.component("enum-input", {
  props: {
    arg: String,
    required: Boolean,
    value: { type: Number, default: undefined },
    enum: String,
  },
  template: `<div class="enum-input vue-select">
      <v-select :value="value" :options="options" :reduce="x => x.value" @input="update"></v-select>
    </div>`,
  created() {
    this.$emit("update", this.arg, this.value, !this.required);
  },
  methods: {
    update(value: string | null) {
      const val = value === null ? undefined : Number(value);
      this.$emit("update", this.arg, val, !this.required || val !== undefined);
    },
  },
  computed: {
    options() {
      return Object.entries(Types[this.enum as keyof typeof Types])
        .filter(([_, value]) => typeof value === "number")
        .map(([label, value]) => ({ label, value }));
    },
  },
});

Vue.component("string-input", {
  props: { arg: String, required: Boolean, value: { type: String, default: undefined } },
  template: `<div class="string-input input-group">
      <input class="input" type="text" :value="value" @input="update($event.target.value)" />
    </div>`,
  created() {
    this.$emit("update", this.arg, this.value, !this.required);
  },
  methods: {
    update(value: string) {
      const val = value === "" ? undefined : value;
      this.$emit("update", this.arg, val, !this.required || val !== undefined);
    },
  },
});

Vue.component("number-input", {
  props: { arg: String, required: Boolean, value: { type: Number, default: undefined } },
  template: `<div class="number-input input-group">
      <input class="input" type="number" :value="value" @input="update($event.target.value)" />
    </div>`,
  created() {
    this.$emit("update", this.arg, this.value, !this.required);
  },
  methods: {
    update(value: string) {
      const val = value === "" ? undefined : Number(value);
      this.$emit("update", this.arg, val, !this.required || val !== undefined);
    },
  },
});

Vue.component("boolean-input", {
  props: { arg: String, required: Boolean, value: { type: Boolean, default: undefined } },
  template: `<div class="boolean-input vue-select">
      <v-select :value="value === undefined ? undefined : String(value)" :options="['true', 'false']" @input="update"></v-select>
    </div>`,
  created() {
    this.$emit("update", this.arg, this.value, !this.required);
  },
  methods: {
    update(value: string | null) {
      const val = value === null ? undefined : value === "true";
      this.$emit("update", this.arg, val, !this.required || val !== undefined);
    },
  },
});

Vue.component("object-display", {
  props: { value: Object },
  template: `<div><slot v-if="value !== null && value !== undefined" :value="value"></slot></div>`,
});

Vue.component("array-display", {
  props: { value: Array },
  data: () => ({ isOpen: true }),
  template: `<span v-if="value !== null && value !== undefined && value.length > 0">
      <button class="button small" type="button" v-on:click="isOpen=!isOpen">
        <span class="button-text" v-if="isOpen">-</span>
        <span class="button-text" v-else>+</span>
      </button>
      <span v-if="!isOpen">...</span>
      <div v-else v-for="v in value">
        <slot :value="v"></slot>
      </div>
    </span>`,
});

Vue.component("enum-display", {
  props: { value: Number, enum: String },
  template: `<span v-if="value !== null && value !== undefined">{{options[value].label}}</span>`,
  computed: {
    options() {
      return Object.entries(Types[this.enum as keyof typeof Types])
        .filter(([_, value]) => typeof value === "number")
        .map(([label, value]) => ({ label, value }));
    },
  },
});

Vue.component("string-display", {
  props: { value: String },
  template: `<span>"{{value}}"</span>`,
});

Vue.component("number-display", {
  props: { value: Number },
  template: `<span>{{value}}</span>`,
});

Vue.component("boolean-display", {
  props: { value: Boolean },
  template: `<span>{{value}}</span>`,
});

Vue.component("key-display", {
  props: { value: String, typeString: String },
  data: () => ({ hover: false }),
  template: `<span>
      <span class="key-display" @mouseover="hover=true" @mouseleave="hover=false">
        {{value}}:
      </span>
      <span v-if="hover">({{typeString}})</span>
    </span>`,
});

Vue.component("plugin-display", {
  props: ["value", "component"],
  render(createElement) {
    const rootData = this.$root.$children[0].$data;
    return createElement(this.component, {
      domProps: {
        val: this.value,
        state: rootData.value,
        client: rootData.client,
      },
      on: {
        error: (e: CustomEvent) => this.$toasted.error(e.detail),
      },
    });
  },
});

const Login = Vue.component("login", {
  template: `<div>
      <button type="submit" class="button submit" @click="handleLoginAnonymous">
        <span class="button-text">Login Anonymously</span>
      </button>
</div>`,
  methods: {
    async handleLoginAnonymous() {
      const token = await RtagClient.loginAnonymous();
      sessionStorage.setItem("user", token);
      const url = this.$route.query.url;
      this.$router.push((Array.isArray(url) ? url[0] : url) || "/");
    },
},
});

const Home = Vue.component("home", {
  data: () => ({ stateId: "" }),
  template: "#home-template",
  methods: {
    createState() {
      const token = sessionStorage.getItem("user")!;
      RtagClient.createState(token, {}).then((stateId) => {
        this.$router.push("/state/" + stateId);
      });
    },
    joinState() {
      this.$router.push("/state/" + this.stateId);
    },
  },
});

const State = Vue.component("state", {
  data: () => ({ value: {}, client: {} }),
  template: "#state-template",
  created() {
    const token = sessionStorage.getItem("user")!;
    RtagClient.connect(location.host, token, this.$route.params.stateId, (state) => {
      this.value = state;
    })
      .then((client) => {
        this.client = client;
      })
      .catch(() => {
        this.$toasted.error("Error during connection");
      });
  },
});

const router = new VueRouter({
  mode: "history",
  routes: [
    { path: "/login", component: Login },
    { path: "/", component: Home },
    { path: "/state/:stateId", component: State },
  ],
});

router.beforeEach((to, from, next) => {
  if (to.path !== "/login" && sessionStorage.getItem("user") === null) {
    next(`/login${to.path === "/" ? "" : "?url=" + to.path}`);
  } else {
    next();
  }
});

new Vue({
  el: "#app",
  router,
});
